/** TrustAnchor Admin — trust-route topology workspace. */
import {
  AnchorAdminWorkspace,
  type AnchorAdminWorkspaceProps,
} from "@shared/components-react/v2/anchor-admin/AnchorAdminWorkspace";

import "./PlayArea.scss";

type Props = Omit<AnchorAdminWorkspaceProps, "flavor">;

export default function PlayArea(props: Props) {
  return <AnchorAdminWorkspace {...props} flavor="trust" />;
}
