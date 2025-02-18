 import { useState } from "react";
 import { Card } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import {
   Accordion,
   AccordionContent,
   AccordionItem,
   AccordionTrigger,
 } from "@/components/ui/accordion";
 import { Badge } from "@/components/ui/badge";
 import { Skeleton } from "@/components/ui/skeleton";
 import { Download, BookOpen, AlertTriangle } from "lucide-react";
 import type { LegalDocument } from "@shared/schema";

 interface SearchResultsProps {
   results: LegalDocument[];
   isLoading: boolean;
 }

 export function SearchResults({ results, isLoading }: SearchResultsProps) {
   const [selectedDocument, setSelectedDocument] = useState<LegalDocument | null>(null);

   if (isLoading) {
     return <SearchResultsSkeleton />;
   }

   return (
     <div className="grid grid-cols-2 gap-4 h-full">
       {/* Results List */}
       <ScrollArea className="h-[calc(100vh-8rem)]">
         <div className="space-y-4 p-4">
           {results.map((doc) => (
             <Card
               key={doc.id}
               className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                 selectedDocument?.id === doc.id ? "border-primary" : ""
               }`}
               onClick={() => setSelectedDocument(doc)}
             >
               <div className="flex justify-between items-start">
                 <div>
                   <h3 className="font-semibold">{doc.title}</h3>
                   <p className="text-sm text-gray-500">
                     {doc.jurisdiction} | {doc.documentType} | {new Date(doc.date).toLocaleDateString()}
                   </p>
                 </div>
                 <Badge variant={getTreatmentBadgeVariant(doc.citations?.treatment)}>
                   {doc.citations?.treatment || "No Treatment"}
                 </Badge>
               </div>

               {doc.holdingSummary && (
                 <p className="mt-2 text-sm text-gray-600">{doc.holdingSummary}</p>
               )}

               {doc.blackLetterLaw && (
                 <div className="mt-2 p-2 bg-gray-50 rounded-md">
                   <p className="text-sm font-medium">Black Letter Law:</p>
                   <p className="text-sm">{doc.blackLetterLaw}</p>
                 </div>
               )}
             </Card>
           ))}
         </div>
       </ScrollArea>

       {/* Document Viewer */}
       {selectedDocument && (
         <div className="border-l border-gray-200 p-4">
           <div className="flex justify-between items-start mb-4">
             <h2 className="text-xl font-semibold">{selectedDocument.title}</h2>
             <div className="flex gap-2">
               <Button variant="outline" size="sm">
                 <Download className="h-4 w-4 mr-2" />
                 Download
               </Button>
               <Button variant="outline" size="sm">
                 <BookOpen className="h-4 w-4 mr-2" />
                 Open in Reader
               </Button>
             </div>
           </div>

           <Accordion type="single" collapsible>
             <AccordionItem value="summary">
               <AccordionTrigger>Summary</AccordionTrigger>
               <AccordionContent>{selectedDocument.summary}</AccordionContent>
             </AccordionItem>

             <AccordionItem value="holding">
               <AccordionTrigger>Holding</AccordionTrigger>
               <AccordionContent>{selectedDocument.holdingSummary}</AccordionContent>
             </AccordionItem>

             <AccordionItem value="blackletter">
               <AccordionTrigger>Black Letter Law</AccordionTrigger>
               <AccordionContent>{selectedDocument.blackLetterLaw}</AccordionContent>
             </AccordionItem>

             <AccordionItem value="citations">
               <AccordionTrigger>Citations</AccordionTrigger>
               <AccordionContent>
                 <div className="space-y-2">
                   {selectedDocument.citations?.citing.map((citation) => (
                     <div key={citation} className="flex items-center gap-2">
                       <span>{citation}</span>
                       {selectedDocument.citations?.treatment[citation] === "NEGATIVE" && (
                         <AlertTriangle className="h-4 w-4 text-warning" />
                       )}
                     </div>
                   ))}
                 </div>
               </AccordionContent>
             </AccordionItem>
           </Accordion>
         </div>
       )}
     </div>
   );
 }

 function SearchResultsSkeleton() {
   return (
     <div className="space-y-4 p-4">
       {Array.from({ length: 5 }).map((_, i) => (
         <div key={i} className="space-y-2">
           <Skeleton className="h-6 w-3/4" />
           <Skeleton className="h-4 w-1/2" />
           <Skeleton className="h-20 w-full" />
         </div>
       ))}
     </div>
   );
 }

 function getTreatmentBadgeVariant(treatment?: string) {
   switch (treatment) {
     case "POSITIVE":
       return "success";
     case "NEGATIVE":
       return "destructive";
     case "OVERRULED":
       return "destructive";
     case "DISTINGUISHED":
       return "warning";
     default:
       return "secondary";
   }
 }