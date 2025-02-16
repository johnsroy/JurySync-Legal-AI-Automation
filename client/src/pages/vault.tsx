import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Layout } from "@/components/layout";

interface VaultDocument {
  id: string;
  fileName: string;
  documentType: string;
  industry: string;
  complianceStatus: string;
  timestamp: string;
  content: string;
}

const Vault = () => {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [isPasscodeModalVisible, setIsPasscodeModalVisible] = useState(false);
  const [isContentModalVisible, setIsContentModalVisible] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [selectedDocument, setSelectedDocument] =
    useState<VaultDocument | null>(null);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [newPasscode, setNewPasscode] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const storedPasscode = localStorage.getItem("vaultPasscode");
    if (!storedPasscode) {
      setIsFirstTime(true);
      setIsPasscodeModalVisible(true);
    }

    loadDocuments();
  }, []);

  const loadDocuments = () => {
    try {
      const storedDocuments = JSON.parse(
        localStorage.getItem("documentVault") || "[]",
      );
      setDocuments(storedDocuments);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (documentId: string) => {
    try {
      const updatedDocuments = documents.filter((doc) => doc.id !== documentId);
      setDocuments(updatedDocuments);
      localStorage.setItem("documentVault", JSON.stringify(updatedDocuments));
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  const handleViewDocument = (document: VaultDocument) => {
    setSelectedDocument(document);
    setIsPasscodeModalVisible(true);
  };

  const handlePasscodeSubmit = () => {
    const storedPasscode = localStorage.getItem("vaultPasscode");
    if (passcode === storedPasscode) {
      setIsPasscodeModalVisible(false);
      setIsContentModalVisible(true);
      toast({
        title: "Success",
        description: "Access granted",
      });
    } else {
      toast({
        title: "Error",
        description: "Incorrect passcode",
        variant: "destructive",
      });
    }
    setPasscode("");
  };

  const handleFirstTimeSetup = () => {
    if (newPasscode.length < 4) {
      toast({
        title: "Error",
        description: "Passcode must be at least 4 characters",
        variant: "destructive",
      });
      return;
    }
    localStorage.setItem("vaultPasscode", newPasscode);
    setIsFirstTime(false);
    setIsPasscodeModalVisible(false);
    toast({
      title: "Success",
      description: "Passcode set successfully",
    });
  };

  const redirectToHome = () => {
    setLocation("/");
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsPasscodeModalVisible(open);
    if (!open) {
      setSelectedDocument(null);
      setPasscode("");
      if (isFirstTime) {
        redirectToHome();
      }
    }
  };

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
          Document Vault
        </h1>
        <p className="mt-2 text-gray-600">
          Securely store and manage your legal documents
        </p>
      </motion.div>

      <Card className="bg-white/80 backdrop-blur-lg">
        <CardHeader>
          <CardTitle>Document Repository</CardTitle>
          <CardDescription>
            View and manage your processed documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Document Type</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Compliance Status</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{doc.fileName}</TableCell>
                  <TableCell>{doc.documentType}</TableCell>
                  <TableCell>{doc.industry}</TableCell>
                  <TableCell>{doc.complianceStatus}</TableCell>
                  <TableCell>{new Date(doc.timestamp).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        onClick={() => handleViewDocument(doc)}
                      >
                        View
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(doc.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Passcode Dialog */}
      <Dialog
        open={isPasscodeModalVisible}
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isFirstTime ? "Set Vault Passcode" : "Enter Passcode"}
            </DialogTitle>
          </DialogHeader>
          {isFirstTime ? (
            <div className="space-y-4">
              <p>
                Please set a passcode for the document vault (minimum 4
                characters):
              </p>
              <Input
                type="password"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                placeholder="Enter new passcode"
              />
              <DialogFooter>
                <Button onClick={handleFirstTimeSetup}>Set Passcode</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <p>Please enter the passcode to view this document:</p>
              <Input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePasscodeSubmit();
                  }
                }}
              />
              <DialogFooter>
                <Button onClick={handlePasscodeSubmit}>Submit</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Document Content Dialog */}
      <Dialog
        open={isContentModalVisible}
        onOpenChange={setIsContentModalVisible}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.fileName}</DialogTitle>
          </DialogHeader>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="font-semibold">Document Type:</p>
                  <p>{selectedDocument?.documentType}</p>
                </div>
                <div>
                  <p className="font-semibold">Industry:</p>
                  <p>{selectedDocument?.industry}</p>
                </div>
                <div>
                  <p className="font-semibold">Compliance Status:</p>
                  <p>{selectedDocument?.complianceStatus}</p>
                </div>
                <div>
                  <p className="font-semibold">Timestamp:</p>
                  <p>
                    {selectedDocument?.timestamp &&
                      new Date(selectedDocument.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <p className="font-semibold mb-2">Content:</p>
                <div className="whitespace-pre-wrap bg-gray-50 p-4 rounded-md">
                  {selectedDocument?.content}
                </div>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

// Add the layout to the Vault page
Vault.getLayout = function getLayout(page: React.ReactElement) {
  return <Layout>{page}</Layout>;
};

export default Vault;