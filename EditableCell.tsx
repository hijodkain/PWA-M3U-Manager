import React, { useState } from 'react';

interface EditableCellProps {
    value: string;
    onSave: (value: string) => void;
    className?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, onSave, className = "truncate" }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(value);

  const handleDoubleClick = () => {
    setText(value);
    setIsEditing(true);
  };
    // ... logic remains same
  const handleBlur = () => {
    if (text !== value) {
      onSave(text);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setText(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        className="w-full bg-gray-700 border border-blue-500 rounded px-1 py-0.5 text-white"
      />
    );
  }

  return (
    <div onDoubleClick={handleDoubleClick} className={`${className} cursor-pointer px-1 py-0.5`}>
      {value}
    </div>
  );
};

export default EditableCell;
