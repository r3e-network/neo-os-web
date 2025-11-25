import { Descriptor } from "../../api";

type Props = { descriptors: Descriptor[] };

export function SystemDescriptorsCard({ descriptors }: Props) {
  return (
    <div className="card inner">
      <h3>Descriptors ({descriptors.length})</h3>
      <ul className="list">
        {descriptors.map((d) => (
          <li key={`${d.domain}:${d.name}`}>
            <div className="row">
              <div>
                <strong>{d.name}</strong> <span className="tag">{d.domain}</span> <span className="tag subdued">{d.layer}</span>
              </div>
              {d.capabilities && <span className="cap">{d.capabilities.join(", ")}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
