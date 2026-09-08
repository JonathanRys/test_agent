import { MobileDatePicker } from "@mui/x-date-pickers/MobileDatePicker";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";

type DatePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  fullWidth?: boolean;
  floatingLabel?: boolean;
};

export default function DatePickerField({
  label,
  value,
  onChange,
  required = false,
  className,
  fullWidth = false,
  floatingLabel = false,
}: DatePickerFieldProps) {
  const [draftValue, setDraftValue] = useState(value);
  const acceptedRef = useRef(false);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  return (
    <div className={floatingLabel ? "date-picker-floating-field" : undefined}>
      {floatingLabel && <span>{label}</span>}
      <MobileDatePicker
        label={floatingLabel ? undefined : label}
        value={draftValue ? dayjs(draftValue) : null}
        onChange={(date) =>
          setDraftValue(date?.isValid() ? date.format("YYYY-MM-DD") : "")
        }
        onAccept={(date) => {
          acceptedRef.current = true;
          const nextValue = date?.isValid() ? date.format("YYYY-MM-DD") : "";
          setDraftValue(nextValue);
          onChange(nextValue);
        }}
        onClose={() => {
          if (!acceptedRef.current) {
            setDraftValue(value);
          }
          acceptedRef.current = false;
        }}
        format="MM/DD/YYYY"
        className={className}
        slotProps={{
          textField: {
            required,
            fullWidth,
            slotProps: {
              htmlInput: { readOnly: true },
              inputLabel: { shrink: !floatingLabel },
            },
            sx: {
              "& .MuiInputBase-root": {
                cursor: "pointer",
                color: "#f8fafc !important",
                fontFamily: "inherit",
                fontSize: "1rem",
              },
              "& .MuiInputBase-input": {
                cursor: "pointer",
                color: "#f8fafc !important",
                WebkitTextFillColor: "#f8fafc !important",
                fontFamily: "inherit",
                fontSize: "1rem",
                opacity: 1,
              },
              "& .MuiPickersInputBase-input, & .MuiPickersSectionList-root, & .MuiPickersSectionList-section":
                {
                  cursor: "pointer",
                  color: "#f8fafc !important",
                  WebkitTextFillColor: "#f8fafc !important",
                  fontFamily: "inherit",
                  fontSize: "1rem",
                  opacity: 1,
                },
              "& .MuiInputLabel-root": {
                color: "#94a3b8 !important",
                backgroundColor: "#0f172a",
                padding: "0 4px",
              },
              "& .MuiPickersInputBase-label": {
                color: "#7dd3fc !important",
              },
              "& fieldset, & .MuiPickersOutlinedInput-notchedOutline": {
                borderColor: "rgba(148, 163, 184, 0.3) !important",
                borderRadius: "12px",
              },
              "& .MuiPickersOutlinedInput-root": {
                padding: "4px 20px 0px",
              },
              "& .MuiIconButton-root": {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                padding: "8px",
                minWidth: 0,
                lineHeight: 1,
                background: "transparent !important",
                color: "#94a3b8 !important",
              },
              "& .MuiInputAdornment-root": {
                alignSelf: "center",
                marginTop: "2px",
              },
              "& .MuiSvgIcon-root": {
                width: "20px",
                height: "20px",
                transform: "translateY(1px)",
                color: "#94a3b8 !important",
              },
            },
          },
          mobilePaper: {
            className: "app-date-picker-dialog",
            sx: {
              backgroundColor: "#0f172a",
              color: "#e2e8f0",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              borderRadius: "16px",
              boxShadow: "0 24px 80px rgba(2, 8, 23, 0.75)",
              "& button": {
                alignSelf: "center",
                minWidth: 0,
                margin: 0,
                border: 0,
                borderRadius: "10px",
                padding: "8px",
                background: "transparent !important",
                color: "#cbd5e1",
                fontWeight: 400,
              },
              "& .MuiPickersToolbar-root": {
                backgroundColor: "#111c32",
                color: "#f8fafc",
                padding: "20px 24px 16px",
              },
              "& .MuiPickersToolbarText-root": {
                color: "#f8fafc",
              },
              "& .MuiTypography-root": {
                color: "#cbd5e1",
              },
              "& .MuiPickersCalendarHeader-root": {
                padding: "8px 16px 4px",
              },
              "& .MuiPickersCalendarHeader-label": {
                color: "#f8fafc",
                fontWeight: 600,
              },
              "& .MuiPickersArrowSwitcher-button": {
                width: "36px",
                height: "36px",
                color: "#bae6fd",
              },
              "& .MuiDayCalendar-weekDayLabel": {
                color: "#94a3b8",
              },
              "& .MuiPickersDay-root": {
                color: "#e2e8f0",
                backgroundColor: "transparent",
                borderRadius: "10px",
              },
              "& .MuiPickersDay-root:hover": {
                backgroundColor: "rgba(56, 182, 255, 0.16)",
              },
              "& .MuiPickersDay-root.Mui-selected": {
                backgroundColor: "#2563eb !important",
                color: "#f0f9ff !important",
              },
              "& .MuiPickersDay-root.Mui-selected:hover": {
                backgroundColor: "#1d4ed8 !important",
              },
              "& .MuiPickersDay-today": {
                borderColor: "#38b6ff",
              },
              "& .MuiDialogActions-root": {
                padding: "12px 20px 20px",
                borderTop: "1px solid rgba(148, 163, 184, 0.15)",
              },
              "& .MuiDialogActions-root button": {
                padding: "8px 14px",
                backgroundColor: "#2563eb !important",
                color: "#f0f9ff !important",
                fontWeight: 600,
              },
              "& .MuiDialogActions-root button:hover": {
                backgroundColor: "#1d4ed8 !important",
              },
              "& .MuiSvgIcon-root": {
                color: "#94a3b8",
              },
            },
          },
          day: {
            sx: {
              "&.Mui-selected, &[aria-selected='true']": {
                backgroundColor: "#2563eb !important",
                color: "#f0f9ff !important",
              },
              "&.Mui-selected:hover, &[aria-selected='true']:hover": {
                backgroundColor: "#1d4ed8 !important",
              },
            },
          },
        }}
      />
    </div>
  );
}
