import { OrganisationName } from "../configs/organisations";

export interface OrgMember {
    org: OrganisationName;
    leader?: boolean;
}
