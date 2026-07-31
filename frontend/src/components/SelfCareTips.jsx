import { Leaf, Search } from "lucide-react";

/**
 * OTC / home-care suggestions shown only for a self_care result. The backend
 * guarantees these are empty for routine/urgent/emergency, so this renders
 * nothing in those cases.
 */
export default function SelfCareTips({ tips, url }) {
  if (!tips?.length) return null;
  return (
    <div className="self-care-tips">
      <div className="tips-head"><Leaf size={15} /> Things that may help</div>
      <ul className="tips-list">
        {tips.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
      <p className="tips-note">
        General drugstore options — read the label and ask your pharmacist before starting anything new.
      </p>
      {url && (
        <a className="tips-link" href={url} target="_blank" rel="noreferrer">
          <Search size={14} /> Search remedies for your symptoms
        </a>
      )}
    </div>
  );
}
