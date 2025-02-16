interface VaultDocument {
  id: string;
  fileName: string;
  documentType: string;
  industry: string;
  complianceStatus: string;
  timestamp: string;
  content: string;
  metadata?: {
    confidence: number;
    recommendations: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
}

const Vault = () => {
  // ... existing state declarations ...

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('compliant') || statusLower.includes('approved')) {
      return 'text-green-600';
    }
    if (statusLower.includes('review') || statusLower.includes('pending')) {
      return 'text-yellow-600';
    }
    return 'text-red-600';
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
        <h1 className="text-3xl font-bold text-gray-900">Document Vault</h1>
        <p className="mt-2 text-gray-600">
          Securely store and manage your legal documents
        </p>
      </motion.div>

      <Card className="bg-white/80 backdrop-blur-lg">
        <CardHeader>
          <CardTitle>Document Repository</CardTitle>
          <CardDescription>View and manage your processed documents</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Compliance Status</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{doc.fileName}</TableCell>
                  <TableCell>{doc.documentType}</TableCell>
                  <TableCell>{doc.industry}</TableCell>
                  <TableCell className={getStatusColor(doc.complianceStatus)}>
                    {doc.complianceStatus}
                  </TableCell>
                  <TableCell>
                    {new Date(doc.timestamp).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDocument(doc)}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
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
                  <p className={getStatusColor(selectedDocument?.complianceStatus || '')}>
                    {selectedDocument?.complianceStatus}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Processed On:</p>
                  <p>
                    {selectedDocument?.timestamp &&
                      new Date(selectedDocument.timestamp).toLocaleString()}
                  </p>
                </div>
                {selectedDocument?.metadata && (
                  <>
                    <div>
                      <p className="font-semibold">Confidence Score:</p>
                      <p>{selectedDocument.metadata.confidence}%</p>
                    </div>
                    <div>
                      <p className="font-semibold">Risk Level:</p>
                      <p>{selectedDocument.metadata.riskLevel}</p>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-4">
                <p className="font-semibold mb-2">Content:</p>
                <div className="whitespace-pre-wrap bg-gray-50 p-4 rounded-md">
                  {selectedDocument?.content}
                </div>
              </div>
              {selectedDocument?.metadata?.recommendations?.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold mb-2">Recommendations:</p>
                  <ul className="list-disc pl-4 space-y-2">
                    {selectedDocument.metadata.recommendations.map((rec, index) => (
                      <li key={index} className="text-gray-600">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      {/* ... rest of the component ... */}
    </motion.div>
  );
};

Vault.getLayout = function getLayout(page: React.ReactElement) {
  return <Layout>{page}</Layout>;
};

export default Vault; 