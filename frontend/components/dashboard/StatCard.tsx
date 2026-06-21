import { LucideIcon } from "lucide-react";

import Card, { CardBody } from "@/components/ui/Card";



interface StatCardProps {

  title: string;

  value: number | string;

  icon: LucideIcon;

  color?: string;

}



export default function StatCard({ title, value, icon: Icon, color = "bg-primary-50 text-primary" }: StatCardProps) {

  return (

    <Card hover>

      <CardBody className="flex items-center gap-4">

        <div className={`p-3.5 rounded-2xl ${color}`}>

          <Icon className="h-6 w-6" />

        </div>

        <div>

          <p className="text-sm font-medium text-gray-500">{title}</p>

          <p className="text-2xl font-bold text-gray-900 tracking-tight mt-0.5">{value}</p>

        </div>

      </CardBody>

    </Card>

  );

}

