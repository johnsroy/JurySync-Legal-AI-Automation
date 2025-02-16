import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: string;
  fileName: string;
  documentType: string;
  industry: string;
  complianceStatus: string;
  timestamp: string;
  content: string;
}

const Vault = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isPasscodeModalVisible, setIsPasscodeModalVisible] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Check if passcode exists
    const storedPasscode = localStorage.getItem('vaultPasscode');
    if (!storedPasscode) {
      setIsFirstTime(true);
      setIsPasscodeModalVisible(true);
    }

    // Load documents
    const storedDocuments = JSON.parse(localStorage.getItem('documentVault') || '[]');
    setDocuments(storedDocuments);
  }, []);

  const handleDelete = (documentId: string) => {
    const updatedDocuments = documents.filter(doc => doc.id !== documentId);
    setDocuments(updatedDocuments);
    localStorage.setItem('documentVault', JSON.stringify(updatedDocuments));
    toast({
      title: "Success",
      description: "Document deleted successfully"
    });
  };

  const handleViewDocument = (document: Document) => {
    setSelectedDocument(document);
    setIsPasscodeModalVisible(true);
  };

  const handlePasscodeSubmit = () => {
    const storedPasscode = localStorage.getItem('vaultPasscode');
    if (passcode === storedPasscode) {
      setIsPasscodeModalVisible(false);
      toast({
        title: "Success",
        description: "Access granted"
      });
      // Add your document viewing logic here
    } else {
      toast({
        title: "Error",
        description: "Incorrect passcode",
        variant: "destructive"
      });
    }
    setPasscode('');
  };

  const handleFirstTimeSetup = () => {
    if (newPasscode.length < 4) {
      toast({
        title: "Error",
        description: "Passcode must be at least 4 characters",
        variant: "destructive"
      });
      return;
    }
    localStorage.setItem('vaultPasscode', newPasscode);
    setIsFirstTime(false);
    setIsPasscodeModalVisible(false);
    toast({
      title: "Success",
      description: "Passcode set successfully"
    });
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Document Vault</h1>

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

      <Dialog 
        open={isPasscodeModalVisible} 
        onOpenChange={setIsPasscodeModalVisible}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isFirstTime ? "Set Vault Passcode" : "Enter Passcode"}
            </DialogTitle>
          </DialogHeader>
          {isFirstTime ? (
            <div className="space-y-4">
              <p>Please set a passcode for the document vault (minimum 4 characters):</p>
              <Input
                type="password"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                placeholder="Enter new passcode"
              />
              <Button onClick={handleFirstTimeSetup}>Set Passcode</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p>Please enter the passcode to view this document:</p>
              <Input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode"
              />
              <Button onClick={handlePasscodeSubmit}>Submit</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vault; 