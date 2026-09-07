import * as React from "react";

export interface TruncationNoticeProps {
  shown: number;
  total: number;
  noun: string;
}

/** One line telling the reader a capped list is not the whole set. */
export function TruncationNotice({
  shown,
  total,
  noun,
}: TruncationNoticeProps): React.ReactElement | null {
  if (total <= shown) {
    return null;
  }
  return (
    <p role="status" className="text-meta text-muted">
      Showing {shown.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")} {noun}.
    </p>
  );
}
