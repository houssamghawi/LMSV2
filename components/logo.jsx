import Image from "next/image";
import React from "react";
import logo from "@/assets/easylogo.png";
import { cn } from "@/lib/utils";

const Logo = ({ className = "", priority = false }) => {
    return (
        <div>
            <Image
                className={cn("max-w-[200px]", className)}
                src={logo}
                alt="Easy Learning Academy"
                width={200}
                height={60}
                sizes="200px"
                priority={priority}
            />
        </div>
    );
};

export default Logo;
export { Logo };