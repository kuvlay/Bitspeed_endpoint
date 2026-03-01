import { LinkPrecedence, type Contact, type Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { IdentifyInput, IdentifyResponse } from "../types/api";

function sortByOldest(a: Contact, b: Contact): number {
  const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
  if (byCreatedAt !== 0) {
    return byCreatedAt;
  }

  return a.id - b.id;
}

function uniqueNonNull(values: Array<string | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(value);
  }

  return result;
}

function buildResponse(primaryId: number, contacts: Contact[]): IdentifyResponse {
  const ordered = [...contacts].sort(sortByOldest);
  const primary = ordered.find((contact) => contact.id === primaryId);
  const secondaries = ordered.filter((contact) => contact.id !== primaryId);

  const emails = uniqueNonNull([
    primary?.email ?? null,
    ...secondaries.map((contact) => contact.email),
  ]);

  const phoneNumbers = uniqueNonNull([
    primary?.phoneNumber ?? null,
    ...secondaries.map((contact) => contact.phoneNumber),
  ]);

  return {
    primaryContactId: primaryId,
    emails,
    phoneNumbers,
    secondaryContactIds: secondaries.map((contact) => contact.id),
  };
}

function seedFilters(input: IdentifyInput): Prisma.ContactWhereInput[] {
  const filters: Prisma.ContactWhereInput[] = [];

  if (input.email) {
    filters.push({ email: input.email });
  }

  if (input.phoneNumber) {
    filters.push({ phoneNumber: input.phoneNumber });
  }

  return filters;
}

async function fetchClusterByPrimaryId(
  tx: Prisma.TransactionClient,
  primaryId: number,
): Promise<Contact[]> {
  return tx.contact.findMany({
    where: {
      deletedAt: null,
      OR: [{ id: primaryId }, { linkedId: primaryId }],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

export async function reconcileIdentity(input: IdentifyInput): Promise<IdentifyResponse> {
  const filters = seedFilters(input);

  if (filters.length === 0) {
    throw new Error("Either email or phoneNumber must be provided.");
  }

  return prisma.$transaction(async (tx) => {
    const seedContacts = await tx.contact.findMany({
      where: {
        deletedAt: null,
        OR: filters,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    if (seedContacts.length === 0) {
      const created = await tx.contact.create({
        data: {
          email: input.email,
          phoneNumber: input.phoneNumber,
          linkPrecedence: LinkPrecedence.primary,
        },
      });

      return buildResponse(created.id, [created]);
    }

    const candidatePrimaryIds = Array.from(
      new Set(
        seedContacts.map((contact) => {
          if (contact.linkPrecedence === LinkPrecedence.primary || contact.linkedId === null) {
            return contact.id;
          }
          return contact.linkedId;
        }),
      ),
    );

    let clusterContacts = await tx.contact.findMany({
      where: {
        deletedAt: null,
        OR: [
          { id: { in: candidatePrimaryIds } },
          { linkedId: { in: candidatePrimaryIds } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    const primaryContacts = clusterContacts
      .filter((contact) => contact.linkPrecedence === LinkPrecedence.primary || contact.linkedId === null)
      .sort(sortByOldest);

    const canonicalPrimary =
      primaryContacts[0] ??
      [...clusterContacts].sort(sortByOldest)[0];

    if (!canonicalPrimary) {
      throw new Error("Unable to resolve canonical contact.");
    }

    const losingPrimaryIds = primaryContacts
      .map((contact) => contact.id)
      .filter((id) => id !== canonicalPrimary.id);

    if (losingPrimaryIds.length > 0) {
      await tx.contact.updateMany({
        where: { id: { in: losingPrimaryIds } },
        data: {
          linkPrecedence: LinkPrecedence.secondary,
          linkedId: canonicalPrimary.id,
        },
      });

      await tx.contact.updateMany({
        where: { linkedId: { in: losingPrimaryIds } },
        data: { linkedId: canonicalPrimary.id },
      });
    }

    clusterContacts = await fetchClusterByPrimaryId(tx, canonicalPrimary.id);

    const hasEmail = input.email
      ? clusterContacts.some((contact) => contact.email === input.email)
      : true;
    const hasPhoneNumber = input.phoneNumber
      ? clusterContacts.some((contact) => contact.phoneNumber === input.phoneNumber)
      : true;

    if (!hasEmail || !hasPhoneNumber) {
      await tx.contact.create({
        data: {
          email: input.email,
          phoneNumber: input.phoneNumber,
          linkedId: canonicalPrimary.id,
          linkPrecedence: LinkPrecedence.secondary,
        },
      });

      clusterContacts = await fetchClusterByPrimaryId(tx, canonicalPrimary.id);
    }

    return buildResponse(canonicalPrimary.id, clusterContacts);
  });
}
