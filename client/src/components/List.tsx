import { GiTrail, GiHiking } from "react-icons/gi";
import { FaMedal } from "react-icons/fa";
import { FaMountain, FaPersonHiking } from "react-icons/fa6";

import ContactForm from "./ContactForm";
import { formatCompletedDate } from "./MarkComplete";

export interface ListProps {
  id: number;
  name: string;
  type: "peakbagging" | "trace";
  description: string;
  abbreviation: string;
  patchAvailable: boolean;
  website?: string;
  phoneNumber?: string;
  emailAddress?: string;
  mailingAddress?: string;
  facebook?: string;
  instagram?: string;
  totalCount?: number;
  completedCount?: number;
  completedDate?: string;
  completions: {
    number: {
      completedAt: string;
      season: string;
    };
  };
}

const List = (props: ListProps) => {
  const {
    type,
    patchAvailable,
    website,
    phoneNumber,
    emailAddress,
    mailingAddress,
    facebook,
    instagram,
    totalCount,
    completedCount,
    completedDate,
  } = props;

  const typeIcon =
    type === "peakbagging" ? (
      <GiHiking title="Peak-bagging list" />
    ) : (
      <GiTrail title="Tracing list" />
    );
  const patchIcon = patchAvailable ? <FaMedal title="Patch available" /> : null;
  const completed = completedCount === totalCount;

  return (
    <div>
      <h2 className="split-title">
        <span>
          {typeIcon} {props.name}
        </span>{" "}
        <span>{patchIcon}</span>
      </h2>
      <p>{props.description}</p>
      {typeof totalCount === "number" && typeof completedCount === "number" && (
        <p
          className={`list-progress${completedCount > 0 && completedCount === totalCount ? " completed" : ""}`}
        >
          {completedCount} / {totalCount}{" "}
          {!completed &&
            `(${Math.round((completedCount / totalCount) * 100)}%)`}{" "}
          complete
          {completed &&
            completedDate &&
            `d on ${formatCompletedDate(completedDate)}`}
        </p>
      )}
      <ContactForm
        website={website}
        phoneNumber={phoneNumber}
        emailAddress={emailAddress}
        mailingAddress={mailingAddress}
        facebook={facebook}
        instagram={instagram}
      />
    </div>
  );
};

export default List;
