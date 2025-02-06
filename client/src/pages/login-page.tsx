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
import { Loader2, Scale } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-green-50 dark:from-gray-900 dark:to-gray-800 animate-gradient-x p-4">
      <Card className="w-full max-w-md bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg shadow-xl border-0">
        <CardHeader className="space-y-1 text-center pb-8">
          <Link href="/" className="flex items-center justify-center space-x-2 mb-2">
            <Scale className="h-8 w-8 text-green-600" />
            <span className="text-2xl font-bold font-display">LegalAI</span>
          </Link>
          <CardTitle className="text-3xl font-bold tracking-tight font-display">
            Welcome back
          </CardTitle>
          <CardDescription className="text-base">
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
                    <FormLabel className="text-base">Username</FormLabel>
                    <FormControl>
                      <Input 
                        className="h-12 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        className="h-12 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-12 text-base bg-gradient-to-r from-green-600 to-yellow-500 hover:from-green-700 hover:to-yellow-600 animate-gradient-x"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Sign In
              </Button>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                Don't have an account?{" "}
                <Link href="/register" className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300">
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