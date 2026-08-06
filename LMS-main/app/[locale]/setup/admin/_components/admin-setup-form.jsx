"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setupFirstAdmin } from "@/app/actions/admin-setup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Shield } from "lucide-react";
import { toast } from "sonner";

export default function AdminSetupForm() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess(false);

        const formData = new FormData(e.target);

        startTransition(async () => {
            try {
                const result = await setupFirstAdmin(formData);
                
                if (result.success) {
                    setSuccess(true);
                    toast.success("Admin account created successfully!");
                    
                    // Redirect to login page - user must sign in
                    setTimeout(() => {
                        router.push("/login?setup=success");
                        router.refresh();
                    }, 2000);
                }
            } catch (err) {
                const errorMessage = err?.message || "Failed to create admin account";
                setError(errorMessage);
                toast.error(errorMessage);
            }
        });
    };

    if (success) {
        return (
            <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                    Admin account created successfully! Redirecting to admin dashboard...
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="rounded-md shadow-sm space-y-4">
                <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                        id="firstName"
                        name="firstName"
                        type="text"
                        required
                        autoComplete="given-name"
                        disabled={isPending}
                        className="mt-1"
                    />
                </div>

                <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                        id="lastName"
                        name="lastName"
                        type="text"
                        required
                        autoComplete="family-name"
                        disabled={isPending}
                        className="mt-1"
                    />
                </div>

                <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        disabled={isPending}
                        className="mt-1"
                    />
                </div>

                <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative mt-1">
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            required
                            autoComplete="new-password"
                            disabled={isPending}
                            className="pe-10"
                            minLength={8}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 end-0 pe-3 flex items-center"
                            disabled={isPending}
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                                <Eye className="h-4 w-4 text-gray-400" />
                            )}
                        </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                        Must be at least 8 characters with uppercase, lowercase, number, and special character
                    </p>
                </div>

                <div>
                    <Label htmlFor="setupKey" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Setup Key
                    </Label>
                    <Input
                        id="setupKey"
                        name="setupKey"
                        type="password"
                        required
                        disabled={isPending}
                        className="mt-1"
                        placeholder="Enter the setup key from environment variables"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Required setup key from ADMIN_SETUP_KEY environment variable
                    </p>
                </div>
            </div>

            <div>
                <Button
                    type="submit"
                    className="w-full"
                    disabled={isPending}
                >
                    {isPending ? "Creating Admin Account..." : "Create Admin Account"}
                </Button>
            </div>

            <div className="text-center">
                <p className="text-xs text-gray-500">
                    ⚠️ This setup can only be completed once. After creating the first admin,
                    this page will no longer be accessible.
                </p>
            </div>
        </form>
    );
}

