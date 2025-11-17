import { 
  MoreVertical, 
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface ChatControlsMenuProps {
  chatId: string;
  onDelete: (chatId: string) => void;
}

export function ChatControlsMenu({
  chatId,
  onDelete,
}: ChatControlsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => onDelete(chatId)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete for Me
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
