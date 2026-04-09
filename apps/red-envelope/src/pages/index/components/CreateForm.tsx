import "./CreateForm.scss";

interface CreateFormProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function CreateForm(props: CreateFormProps) {
  return (
    <div className="CreateForm">
      {/* Migrated from CreateForm.vue */}
    </div>
  );
}
