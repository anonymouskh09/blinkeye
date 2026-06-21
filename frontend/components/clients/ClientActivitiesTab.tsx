"use client";

import EntityActivitiesTab from "@/components/activities/EntityActivitiesTab";
import type { Client, ClientActivity, User as AppUser } from "@/types";

interface Props {
  client: Client;
  clientId: string;
  activities: ClientActivity[];
  users: AppUser[];
  onRefresh: () => void;
}

export default function ClientActivitiesTab({ client, clientId, activities, users, onRefresh }: Props) {
  return (
    <EntityActivitiesTab
      entityType="client"
      entityId={clientId}
      relatedLabel={client.company_name}
      activities={activities}
      users={users}
      onRefresh={onRefresh}
    />
  );
}
