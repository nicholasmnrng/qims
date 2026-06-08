"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ id, task }: { id: string, task: any }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="p-3 mb-2 bg-secondary rounded-md shadow-sm border flex justify-between items-center cursor-grab">
      <div>
        <p className="font-medium text-sm">{task.title}</p>
        <p className="text-xs text-muted-foreground">{task.status}</p>
      </div>
      <div className="text-xs font-bold uppercase">{task.priority}</div>
    </div>
  );
}

export function OperationsView() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  
  const { data: assignmentsData } = useQuery({
    queryKey: ["assignments", date],
    queryFn: () => fetch(`/api/shift-assignments?limit=10`).then(res => res.json()) // dummy limit
  });

  const { data: tasksData } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetch("/api/tasks?limit=20").then(res => res.json())
  });

  const assignments = assignmentsData?.data?.items || [];
  const rawTasks = tasksData?.data?.items || [];

  const [tasks, setTasks] = useState(rawTasks);

  // Sync state if fetched
  if (tasks.length === 0 && rawTasks.length > 0) setTasks(rawTasks);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over.id) {
      setTasks((items: any) => {
        const oldIndex = items.findIndex((i: any) => i.id === active.id);
        const newIndex = items.findIndex((i: any) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      toast.success("Task priority updated!");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Shift Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? <p className="text-sm text-muted-foreground">No assignments for this date.</p> : (
               <div className="space-y-2">
                 {assignments.map((a: any) => (
                   <div key={a.id} className="p-2 border rounded-md">
                     <span className="font-medium">{a.user?.name}</span> - {a.area?.name}
                   </div>
                 ))}
               </div>
            )}
            <div className="mt-4">
               <Button onClick={() => {
                 fetch("/api/rotation-recommendations").then(r => r.json()).then(res => {
                    toast.info("Recommendations: " + res.data.length + " items generated.");
                 });
               }}>Generate Recommendations</Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ListChecks className="w-5 h-5"/> Task Priority (Drag to reorder)</CardTitle>
          </CardHeader>
          <CardContent>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tasks.map((t: any) => t.id)} strategy={verticalListSortingStrategy}>
                {tasks.map((task: any) => <SortableItem key={task.id} id={task.id} task={task} />)}
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
