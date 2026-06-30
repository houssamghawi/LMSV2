"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { GraduationCap } from "lucide-react";
import { ArrowUpDown, MoreHorizontal, Pencil } from "lucide-react";
import Link from "next/link";
import { formatMyDate } from "@/lib/date";

export function getColumns(t) {
  return [
    {
      id: "name",
      accessorKey: "studentName",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("studentName")} <ArrowUpDown className="ms-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return <div dir="auto">{row.getValue("studentName")}</div>;
      },
    },
    {
      accessorKey: "studentEmail",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("studentEmail")} <ArrowUpDown className="ms-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        return <div dir="auto">{row.getValue("studentEmail")}</div>;
      },
    },
    {
      accessorKey: "progress",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("progress")} <ArrowUpDown className="ms-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const progress = row.getValue("progress");
        return `${progress}%`;
      },
    },
    {
      accessorKey: "enrollment_date",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("enrollDate")} <ArrowUpDown className="ms-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const enrollmentDate = row.getValue("enrollment_date");
        return formatMyDate(enrollmentDate);
      },
    },
  ];
}
