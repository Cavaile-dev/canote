import { Plus } from "../icons";
import { Button } from "../ui/button";

interface NewNoteMenuProps {
  onNewNote: () => void;
  onNewChat?: () => void;
}

export default function NewNoteMenu({ onNewNote }: NewNoteMenuProps) {
  return (
    <Button size="sm" variant="outline" onClick={onNewNote}>
      <Plus size={14} />
      Kuliah baru
    </Button>
  );
}
