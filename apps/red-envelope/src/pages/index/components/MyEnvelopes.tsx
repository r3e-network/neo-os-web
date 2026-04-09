import "./MyEnvelopes.scss";

interface MyEnvelopesProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  [key: string]: unknown;
}

export default function MyEnvelopes(props: MyEnvelopesProps) {
  return (
    <div className="MyEnvelopes">
      {/* Migrated from MyEnvelopes.vue */}
    </div>
  );
}
