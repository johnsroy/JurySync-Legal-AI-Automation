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
import { Loader2 } from "lucide-react";
import { Gavel } from "lucide-react";

export default function LoginPage() {
  const { user, loginMutation } = useAuth();

  const form = useForm<Pick<InsertUser, "username" | "password">>({
    resolver: zodResolver(
      insertUserSchema.pick({
        username: true,
        password: true
      })
    ),
    defaultValues: {
      username: "",
      password: "",
    },
  });

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
            Welcome back
          </CardTitle>
          <CardDescription className="text-base text-gray-300">
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) =>
                loginMutation.mutate(data),
              )}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base text-gray-200">Username</FormLabel>
                    <FormControl>
                      <Input
                        className="h-12 bg-background/50 border-border text-white placeholder:text-gray-400"
                        {...field}
                      />
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
                      <Input
                        type="password"
                        className="h-12 bg-background/50 border-border text-white placeholder:text-gray-400"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-400" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-white"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Sign In
              </Button>
              <p className="text-center text-sm text-gray-300">
                Don't have an account?{" "}
                <Link href="/register" className="text-primary hover:text-primary/90">
                  Create one
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}