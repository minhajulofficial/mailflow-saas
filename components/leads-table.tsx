"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface LeadRow {
  id: string;
  person_name: string | null;
  company: string | null;
  email: string | null;
  email_status: string | null;
  status: string | null;
  country: string | null;
  city: string | null;
  collected_at: string | null;
}

export default function LeadsTable({ leads }: { leads: LeadRow[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Collected</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell>{lead.person_name}</TableCell>
              <TableCell>{lead.company}</TableCell>
              <TableCell>{lead.email}</TableCell>
              <TableCell>
                <Badge variant="outline">{lead.email_status}</Badge>
              </TableCell>
              <TableCell>
                {lead.city}, {lead.country}
              </TableCell>
              <TableCell>{new Date(lead.collected_at || 0).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
