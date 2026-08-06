"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DragDropContext,
  Droppable,
  Draggable,
} from "@hello-pangea/dnd";
import { Grip, Pencil, CirclePlay } from "lucide-react";

import { getDraggableItemId } from "@/lib/convertData";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const LessonList = ({ items, onReorder, onEdit }) => {
  const t = useTranslations("ChapterEdit");
  const [isMounted, setIsMounted] = useState(false);
  const [lessons, setLessons] = useState(items);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setLessons(items);
  }, [items]);

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(lessons);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const startIndex = Math.min(result.source.index, result.destination.index);
    const endIndex = Math.max(result.source.index, result.destination.index);

    const updatedLessons = items.slice(startIndex, endIndex + 1);

    setLessons(items);

    const bulkUpdateData = updatedLessons.map((lesson) => ({
      id: getDraggableItemId(lesson),
      position: items.findIndex(
        (item) => getDraggableItemId(item) === getDraggableItemId(lesson)
      ),
    }));

    onReorder(bulkUpdateData);
  };

  if (!isMounted) {
    return null;
  }

  const draggableLessons = lessons
    .map((lesson) => ({ lesson, id: getDraggableItemId(lesson) }))
    .filter((entry) => entry.id);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="lessons">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {draggableLessons.map(({ lesson, id }, index) => (
              <Draggable key={id} draggableId={id} index={index}>
                {(provided) => (
                  <div
                    className={cn(
                      "flex items-center gap-x-2 bg-slate-200 border-slate-200 border text-slate-700 rounded-md mb-4 text-sm",
                      lesson.active &&
                        "bg-sky-100 border-sky-200 text-sky-700"
                    )}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                  >
                    <div
                      className={cn(
                        "px-2 py-3 border-e border-e-slate-200 hover:bg-slate-300 rounded-s-md transition",
                        lesson.active &&
                          "border-e-sky-200 hover:bg-sky-200"
                      )}
                      {...provided.dragHandleProps}
                    >
                      <Grip className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <CirclePlay size={18} />
                      <span dir="auto">{lesson.title}</span>
                    </div>
                    <div className="ms-auto pe-2 flex items-center gap-x-2">
                      <Badge
                        className={cn(
                          "bg-gray-500",
                          lesson.active && "bg-emerald-600"
                        )}
                      >
                        {lesson.active ? t("published") : t("draft")}
                      </Badge>
                      <Pencil
                        onClick={() => onEdit(id)}
                        className="w-4 h-4 cursor-pointer hover:opacity-75 transition"
                      />
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};
