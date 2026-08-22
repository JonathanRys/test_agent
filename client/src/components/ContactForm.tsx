import { FaFacebook, FaInstagram } from "react-icons/fa";

export interface ContactFormProps {
  website?: string;
  phoneNumber?: string;
  emailAddress?: string;
  mailingAddress?: string;
  facebook?: string;
  instagram?: string;
}

const ContactForm = (props: ContactFormProps) => {
  return (
    <div>
      <h3>Contact Information</h3>
      <ul>
        {props.website && (
          <li>
            Website:{" "}
            <a
              href={props.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {props.website}
            </a>
          </li>
        )}
        {props.emailAddress && (
          <li>
            Email:{" "}
            <a
              href={`mailto:${props.emailAddress}`}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {props.emailAddress}
            </a>
          </li>
        )}
        {props.phoneNumber && <li>Phone: {props.phoneNumber}</li>}
        {props.mailingAddress && (
          <li>
            Mailing Address:
            <div className="mailing-address">{props.mailingAddress}</div>
          </li>
        )}
        {props.facebook && (
          <span className="media">
            <a
              href={props.facebook}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <FaFacebook />
            </a>
          </span>
        )}
        {props.instagram && (
          <span className="media">
            <a
              href={props.instagram}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <FaInstagram />
            </a>
          </span>
        )}
      </ul>
    </div>
  );
};

export default ContactForm;
