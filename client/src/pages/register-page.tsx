import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, InsertUser } from "@shared/schema";
import { Redirect, Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Gavel } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function RegisterPage() {
  const { user, registerMutation } = useAuth();
  const { toast } = useToast();

  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "CLIENT",
    },
  });

  const onSubmit = async (data: InsertUser) => {
    try {
      // Register user
      await registerMutation.mutateAsync(data);

      // Start free trial
      const response = await fetch('/api/subscription/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to start trial');
      }

      toast({
        title: "Welcome to JurySync!",
        description: "Your free trial has started.",
      });
    } catch (error) {
      toast({
        title: "Registration Error",
        description: error instanceof Error ? error.message : "Registration failed",
        variant: "destructive",
      });
    }
  };

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <Card className="w-full max-w-md bg-background/95 backdrop-blur-lg shadow-xl border-border">
        <CardHeader className="space-y-1 text-center pb-8">
          <Link href="/" className="flex items-center justify-center space-x-2 mb-2">
            <Gavel className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-white">JurySync.io</span>
          </Link>
          <CardTitle className="text-3xl font-bold tracking-tight text-white">
            Start Your Free Trial
          </CardTitle>
          <CardDescription className="text-base text-gray-300">
            1-day free trial, no credit card required
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base text-gray-200">First Name</FormLabel>
                      <FormControl>
                        <Input className="h-12 bg-background/50 border-border text-white placeholder:text-gray-400" {...field} />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base text-gray-200">Last Name</FormLabel>
                      <FormControl>
                        <Input className="h-12 bg-background/50 border-border text-white placeholder:text-gray-400" {...field} />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base text-gray-200">Email</FormLabel>
                    <FormControl>
                      <Input type="email" className="h-12 bg-background/50 border-border text-white placeholder:text-gray-400" {...field} />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base text-gray-200">Username</FormLabel>
                    <FormControl>
                      <Input className="h-12 bg-background/50 border-border text-white placeholder:text-gray-400" {...field} />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base text-gray-200">Password</FormLabel>
                    <FormControl>
                      <Input type="password" className="h-12 bg-background/50 border-border text-white placeholder:text-gray-400" {...field} />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-white"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Start Free Trial
              </Button>
              <p className="text-center text-sm text-gray-300">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:text-primary/90">
                  Sign in
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}