export function LegalLoadingAnimation() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
      <div className="relative">
        <Scale className="h-16 w-16 text-primary animate-bounce" />
        <div className="absolute inset-0 h-16 w-16 animate-ping opacity-75 rounded-full bg-primary/20" />
      </div>
      <h3 className="mt-6 text-xl font-semibold text-gray-900">
        Processing Legal Document
      </h3>
      <p className="mt-2 text-sm text-gray-600">
        Our AI is carefully reviewing your document with legal precision...
      </p>
      <div className="mt-6 w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full animate-progress" />
      </div>
      <div className="mt-4 text-xs text-gray-500">
        Ensuring compliance with legal standards
      </div>
    </div>
  );
}
