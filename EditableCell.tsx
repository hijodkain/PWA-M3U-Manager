import React, { useState } from 'react';

interface EditableCellProps {
    value: string;
    onSave: (value: string) => void;
    className?: string;
    suggestions?: string[];
    onEditingChange?: (isEditing: boolean) => void;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, onSave, className = "truncate", suggestions, onEditingChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(value);
  const listId = React.useId();

  const stopEditing = () => {
    setIsEditing(false);
    onEditingChange?.(false);
  };

  const handleDoubleClick = () => {
    setText(value);
    setIsEditing(true);
    onEditingChange?.(true);
  };

  const handleBlur = () => {
    if (text !== value) {
      onSave(text);
    }
    stopEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setText(value);
      stopEditing();
    }
  };

  if (isEditing) {
    return (
      <>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          list={suggestions ? listId : undefined}
          className="w-full bg-gray-700 border border-blue-500 rounded px-1 py-0.5 text-white"
        />
        {suggestions && (
          <datalist id={listId}>
            {suggestions.map((s, i) => (
              <option key={i} value={s} />
            ))}
          </datalist>
        )}
      </>
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`w-full min-h-[22px] cursor-pointer px-1 py-0.5 flex items-center ${className}`}
      title="Doble clic para editar"
    >
      {value || <span className="w-full">&nbsp;</span>}
    </div>
  );
};

export default EditableCell;
