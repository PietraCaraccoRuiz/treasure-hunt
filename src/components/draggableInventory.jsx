import { useEffect, useRef, useState } from "react";

export default function DraggableInventory({ treasures, clueOrder, clues, onReorder }) {
  const [dragState, setDragState] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const itemRefs = useRef({});
  const dragRef = useRef(null);
  const orderRef = useRef(clueOrder);

  useEffect(() => {
    orderRef.current = clueOrder;
  }, [clueOrder]);

  useEffect(() => () => cleanupListeners(), []);

  function cleanupListeners() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }

  function onPointerMove(event) {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const moved = drag.moved || Math.abs(dx) > 5 || Math.abs(dy) > 5;
    let targetIndex = drag.originIndex;

    for (let index = 0; index < orderRef.current.length; index += 1) {
      const currentId = orderRef.current[index];
      const element = itemRefs.current[currentId];
      if (!element) continue;

      const rect = element.getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) {
        targetIndex = index;
        break;
      }

      targetIndex = index;
    }

    const updated = {
      ...drag,
      moved,
      currentIndex: targetIndex,
      ghostPos: {
        x: event.clientX - drag.offsetX,
        y: event.clientY - drag.offsetY,
      },
    };

    dragRef.current = updated;
    setDragState(updated);
    setOverIndex(targetIndex);
  }

  function onPointerUp() {
    const drag = dragRef.current;
    cleanupListeners();

    if (drag?.moved) {
      const updated = [...orderRef.current];
      const [removed] = updated.splice(drag.originIndex, 1);
      updated.splice(drag.currentIndex, 0, removed);
      onReorder(updated);
    }

    dragRef.current = null;
    setDragState(null);
    setOverIndex(null);
  }

  function handlePointerDown(event, id, index) {
    event.preventDefault();
    const element = itemRefs.current[id];
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const state = {
      id,
      originIndex: index,
      currentIndex: index,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      ghostPos: { x: rect.left, y: rect.top },
      ghostSize: { w: rect.width },
      moved: false,
    };

    dragRef.current = state;
    setDragState(state);
    setOverIndex(index);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function renderItem(id, index, ghost = false) {
    const point = treasures.find((item) => item.id === id);
    const state = clues[id];
    const dragging = dragState?.id === id;

    if (!state) {
      return (
        <div className="inventory-item is-locked" key={id}>
          <span>Pista bloqueada</span>
        </div>
      );
    }

    return (
      <div
        className={`inventory-item ${state === "full" ? "is-full" : "is-partial"} ${dragging && !ghost ? "is-dragging" : ""} ${overIndex === index && dragState?.id !== id ? "is-over" : ""}`}
        key={id}
        ref={(element) => {
          if (element && !ghost) itemRefs.current[id] = element;
        }}
        onPointerDown={ghost ? undefined : (event) => handlePointerDown(event, id, index)}
        style={{ "--item-color": point.color }}
      >
        <img src={point.pokemon.sprite} alt={point.pokemon.name} />
        <div>
          <strong>{state === "full" ? "PISTA COMPLETA" : "PISTA PARCIAL"}</strong>
          <p>"{state === "full" ? point.clue.full : point.clue.partial}"</p>
        </div>
        <span className="drag-handle">::</span>
      </div>
    );
  }

  const hasAnyClue = Object.keys(clues).length > 0;

  return (
    <div className="inventory-list">
      {dragState?.moved && (
        <div
          className="inventory-ghost"
          style={{
            left: dragState.ghostPos.x,
            top: dragState.ghostPos.y,
            width: dragState.ghostSize.w,
          }}
        >
          {renderItem(dragState.id, dragState.currentIndex, true)}
        </div>
      )}

      {clueOrder.map((id, index) => renderItem(id, index))}

      {!hasAnyClue && (
        <div className="empty-inventory">
          Colete pistas nos quizzes primeiro.
        </div>
      )}
    </div>
  );
}
