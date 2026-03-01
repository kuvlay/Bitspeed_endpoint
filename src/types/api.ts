export type IdentifyInput = {
    email: string | null;
    phoneNumber: string | null;
};

export type IdentifyResponse = {
    primaryContactId:number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
};
