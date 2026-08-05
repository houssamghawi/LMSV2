"use client";

import { Logo } from "@/components/logo";
import { MobileSidebar } from "./mobile-sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { getSafeImageUrl } from "@/lib/image-utils";

export const Navbar = () => {

  const [loggedInUser, setLoggedInUser] = useState(null);

  useEffect(() => {  
      async function fetchMe() {
          try {
              const response = await fetch("/api/me", {
                  cache: 'no-store' // Always fetch fresh data
              });
              if (response.ok) {
                  const data = await response.json();
                  setLoggedInUser(data);
              }
          } catch (error) {
              console.error('Failed to fetch user:', error);
          }
      }
      fetchMe();
      
      // Refresh user data when window regains focus (in case avatar was updated in another tab)
      const handleFocus = () => {
          fetchMe();
      };
      window.addEventListener('focus', handleFocus);
      
      return () => {
          window.removeEventListener('focus', handleFocus);
      };
  },[]);



  return (
    <div className="p-4 border-b h-full flex items-center bg-white shadow-sm">
      <MobileSidebar />
      <div className="flex items-center justify-end  w-full">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="cursor-pointer">
              <Avatar>
                <AvatarImage
                  src={getSafeImageUrl(loggedInUser?.profilePicture)}
                  alt={loggedInUser?.firstName || "User"}
                  onError={(e) => {
                    e.target.src = '/assets/images/profile.jpg';
                  }}
                />
                <AvatarFallback>
                  {loggedInUser?.firstName?.[0] || 'U'}
                  {loggedInUser?.lastName?.[0] || ''}
                </AvatarFallback>
              </Avatar>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-4">
          
          <DropdownMenuItem className="cursor-pointer">
              <Link href="/account">Profile</Link>
           </DropdownMenuItem>

            <DropdownMenuItem className="cursor-pointer">
              <Link href="#" onClick={(e) => {
                e.preventDefault();
                signOut({ callbackUrl: '/' });
              }}>Logout</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
