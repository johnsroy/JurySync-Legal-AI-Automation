import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Layout } from "@/components/layout";

export function HistoryReports() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="text-center mb-8"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="text-3xl font-bold text-gray-900">
          History & Reports
        </h1>
        <p className="mt-2 text-gray-600">
          View your document history and analytics
        </p>
      </motion.div>

      <Card className="bg-white/80 backdrop-blur-lg">
        <CardHeader>
          <CardTitle>Document History</CardTitle>
          <CardDescription>
            Track your document processing history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Add your history and reports content here */}
        </CardContent>
      </Card>
    </motion.div>
  );
}

HistoryReports.getLayout = function getLayout(page: React.ReactElement) {
  return <Layout>{page}</Layout>;
};

export default HistoryReports; 