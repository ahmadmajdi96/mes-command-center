import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export function ConfirmDelete({
  onConfirm,
  label = "Delete",
  description = "This action cannot be undone.",
  trigger,
}: {
  onConfirm: () => void;
  label?: string;
  description?: string;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <button className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground hover:text-destructive hover:border-destructive/40">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="glass-panel">
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              onConfirm();
              toast.success(`${label.replace("Delete ", "")} deleted`);
              setOpen(false);
            }}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
