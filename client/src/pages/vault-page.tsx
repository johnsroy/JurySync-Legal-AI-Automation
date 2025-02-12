import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Folder, X, FileArchive } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VaultPage() {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFiles(event.target.files);
    }
  };

  const handleUpload = () => {
    if (selectedFiles) {
      console.log('Files selected for upload:', Array.from(selectedFiles));
      setIsUploading(true);
      // Simulate upload delay
      setTimeout(() => {
        setIsUploading(false);
        setSelectedFiles(null);
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-green-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Vault</h1>
              <p className="text-gray-600 mt-2">Securely store and manage your legal documents</p>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Upload Documents</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                      "hover:border-green-500 hover:bg-green-50",
                      selectedFiles ? "border-green-500 bg-green-50" : "border-gray-300"
                    )}
                    onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                  >
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.txt"
                    />
                    <FileArchive className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      {selectedFiles ? (
                        <span className="text-green-600 font-medium">
                          {selectedFiles.length} file(s) selected
                        </span>
                      ) : (
                        "Click to select files or drag and drop"
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Supports: PDF, DOC, DOCX, TXT
                    </p>
                  </div>

                  {selectedFiles && (
                    <ScrollArea className="h-[200px] rounded-md border p-4">
                      <div className="space-y-2">
                        {Array.from(selectedFiles).map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-white p-2 rounded-lg shadow-sm"
                          >
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4 text-green-600" />
                              <span className="text-sm text-gray-700 truncate max-w-[200px]">
                                {file.name}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFiles(null);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={handleUpload}
                      disabled={!selectedFiles || isUploading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isUploading ? (
                        <>
                          <span className="animate-spin mr-2">⌛</span>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Empty State */}
          {Array.from({ length: 0 }).length === 0 ? (
            <div className="col-span-full">
              <Card className="border-dashed border-2 border-gray-200">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Folder className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Documents Yet</h3>
                  <p className="text-gray-500 text-center mb-4">
                    Upload your first document to get started
                  </p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="bg-green-600 hover:bg-green-700">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Document
                      </Button>
                    </DialogTrigger>
                    {/* Reuse the same dialog content here */}
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Upload Documents</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div
                          className={cn(
                            "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                            "hover:border-green-500 hover:bg-green-50",
                            selectedFiles ? "border-green-500 bg-green-50" : "border-gray-300"
                          )}
                          onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                        >
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleFileSelect}
                            accept=".pdf,.doc,.docx,.txt"
                          />
                          <FileArchive className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="mt-2 text-sm text-gray-600">
                            {selectedFiles ? (
                              <span className="text-green-600 font-medium">
                                {selectedFiles.length} file(s) selected
                              </span>
                            ) : (
                              "Click to select files or drag and drop"
                            )}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Supports: PDF, DOC, DOCX, TXT
                          </p>
                        </div>

                        {selectedFiles && (
                          <ScrollArea className="h-[200px] rounded-md border p-4">
                            <div className="space-y-2">
                              {Array.from(selectedFiles).map((file, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between bg-white p-2 rounded-lg shadow-sm"
                                >
                                  <div className="flex items-center space-x-2">
                                    <FileText className="h-4 w-4 text-green-600" />
                                    <span className="text-sm text-gray-700 truncate max-w-[200px]">
                                      {file.name}
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedFiles(null);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}

                        <div className="flex justify-end">
                          <Button
                            onClick={handleUpload}
                            disabled={!selectedFiles || isUploading}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {isUploading ? (
                              <>
                                <span className="animate-spin mr-2">⌛</span>
                                Uploading...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>
          ) : (
            // Document Cards (will be populated with actual data)
            Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    <FileText className="h-8 w-8 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        Document Name {index + 1}
                      </h3>
                      <p className="text-sm text-gray-500">Added on Feb 12, 2025</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}