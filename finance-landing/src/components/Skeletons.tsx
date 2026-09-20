

export const CardSkeleton = () => {
  return (
    <div className="bg-card border border-border p-4 rounded-lg shadow-sm flex flex-col justify-between min-h-[220px] animate-pulse">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-muted"></div>
          <div>
            <div className="h-4 w-16 bg-muted rounded mb-1"></div>
            <div className="h-2 w-20 bg-muted rounded"></div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="h-4 w-12 bg-muted rounded"></div>
          <div className="h-2 w-10 bg-muted rounded"></div>
        </div>
      </div>
      <div className="flex-1 mt-4 relative bg-muted/50 rounded"></div>
      <div className="flex flex-col mt-2 px-1 gap-1">
        <div className="h-3 w-16 bg-muted rounded"></div>
        <div className="h-3 w-24 bg-muted rounded"></div>
      </div>
    </div>
  );
};

export const TableRowSkeleton = () => {
  return (
    <tr className="border-b border-border/50 animate-pulse">
      <td className="py-2.5 px-4">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-muted rounded-full"></div>
          <div className="w-7 h-7 bg-muted rounded-full"></div>
          <div className="flex flex-col gap-1">
            <div className="h-3 w-16 bg-muted rounded"></div>
            <div className="h-2 w-24 bg-muted rounded"></div>
          </div>
        </div>
      </td>
      <td className="py-2.5 px-4 text-right">
        <div className="h-4 w-16 bg-muted rounded ml-auto"></div>
      </td>
      <td className="py-2.5 px-4 text-right">
        <div className="h-5 w-12 bg-muted rounded ml-auto"></div>
      </td>
      <td className="py-2.5 px-4 text-right">
        <div className="h-4 w-16 bg-muted rounded ml-auto"></div>
      </td>
      <td className="py-2.5 px-4 text-right">
        <div className="h-4 w-16 bg-muted rounded ml-auto"></div>
      </td>
    </tr>
  );
};

export const OverviewSkeleton = () => {
  return (
    <div className="w-full flex gap-4 overflow-x-auto hide-scrollbar pb-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex-shrink-0 w-[250px] bg-card border border-border p-4 rounded-lg animate-pulse">
           <div className="flex justify-between">
             <div className="h-4 w-16 bg-muted rounded"></div>
             <div className="h-4 w-12 bg-muted rounded"></div>
           </div>
           <div className="mt-4 h-8 w-24 bg-muted rounded"></div>
        </div>
      ))}
    </div>
  );
};

export const TopMoverSkeleton = () => {
  return (
    <div className="flex items-center justify-between p-3 bg-background border border-border rounded-lg animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-muted"></div>
        <div className="h-4 w-16 bg-muted rounded"></div>
      </div>
      <div className="h-4 w-12 bg-muted rounded"></div>
    </div>
  );
};

export const ChartSkeleton = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-card rounded animate-pulse">
       <div className="w-full h-full bg-muted/20"></div>
    </div>
  );
};
