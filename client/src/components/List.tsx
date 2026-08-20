import { GiTrail, GiHiking } from "react-icons/gi";
import { FaAward, FaTrophy, FaMedal } from "react-icons/fa";
import { FaMountain, FaPersonHiking } from "react-icons/fa6";

import ContactForm from "./ContactForm";

export interface ListProps {
  id: number;
  name: string;
  state?: string;
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
        {patchIcon}
      </h2>
      <p>{props.description}</p>
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
