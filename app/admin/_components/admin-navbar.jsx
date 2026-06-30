"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SafeImage } from "@/components/safe-image";
import { LogOut, User } from "lucide-react";
import Link from "next/link";

export default function AdminNavbar({ user }) {
    return (
        <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
                    <p className="text-sm text-gray-500">Manage your platform</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                <Avatar className="h-10 w-10">
                                    <SafeImage
                                        src={user?.profilePicture}
                                        alt={user?.name || "Admin"}
                                        width={40}
                                        height={40}
                                        fallback="/assets/images/profile.jpg"
                                    />
                                    <AvatarFallback>
                                        {user?.name?.charAt(0) || "A"}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem asChild>
                                <Link href="/account" className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Profile
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => signOut({ callbackUrl: "/" })}
                                className="text-red-600 cursor-pointer"
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Logout
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}

