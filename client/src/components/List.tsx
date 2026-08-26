import { GiTrail, GiHiking } from "react-icons/gi";
import { FaAward, FaTrophy, FaMedal } from "react-icons/fa";
import { FaMountain, FaPersonHiking } from "react-icons/fa6";

import ContactForm from "./ContactForm";
import { State } from "../types/State";

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
  } = props;

  const typeIcon =
    type === "peakbagging" ? (
      <GiHiking title="Peak-bagging list" />
    ) : (
      <GiTrail title="Tracing list" />
    );
  const patchIcon = patchAvailable ? <FaMedal title="Patch available" /> : null;

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
        <p className="list-progress">
          {completedCount} / {totalCount} complete
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
