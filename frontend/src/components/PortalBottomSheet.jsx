import { createPortal } from "react-dom";

export default function PortalBottomSheet({ children }) {
  return createPortal(children, document.body);
}
