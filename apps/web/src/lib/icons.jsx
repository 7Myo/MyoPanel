import { memo } from "react";

const strokeProps = {
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none"
};

const Icon = memo(function Icon({ children, size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
});

function mk(paths) {
  const Comp = memo(function Comp({ size, className }) {
    return (
      <Icon size={size} className={className}>
        {paths.map((d, i) => (
          <path key={i} d={d} {...strokeProps} />
        ))}
      </Icon>
    );
  });
  Comp.displayName = "Icon";
  return Comp;
}

export const DashboardIcon = mk([
  "M3 3h7v7H3V3z",
  "M14 3h7v7h-7V3z",
  "M3 14h7v7H3v-7z",
  "M14 14h7v7h-7v-7z"
]);

export const BotIcon = mk([
  "M12 2a2 2 0 012 2v1h2a4 4 0 014 4v8a4 4 0 01-4 4H8a4 4 0 01-4-4V9a4 4 0 014-4h2V4a2 2 0 012-2z",
  "M9 12h.01",
  "M15 12h.01",
  "M12 16a2 2 0 01-2-2"
]);

export const ImportIcon = mk([
  "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4",
  "M17 8l-5-5-5 5",
  "M12 3v12"
]);

export const CommandsIcon = mk([
  "M8 9l-3 3 3 3",
  "M16 9l3 3-3 3",
  "M14 7l-4 10"
]);

export const LogsIcon = mk([
  "M4 19.5A2.5 2.5 0 016.5 17H20",
  "M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
  "M8 7h8",
  "M8 11h6",
  "M8 15h4"
]);

export const StorageIcon = mk([
  "M4 6c0-1.1 3.6-2 8-2s8 .9 8 2",
  "M4 6v12c0 1.1 3.6 2 8 2s8-.9 8-2V6",
  "M4 12c0 1.1 3.6 2 8 2s8-.9 8-2"
]);

export const UsersIcon = mk([
  "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2",
  "M9 11a4 4 0 100-8 4 4 0 000 8z",
  "M23 21v-2a4 4 0 00-3-3.87",
  "M16 3.13a4 4 0 010 7.75"
]);

export const BackupsIcon = mk([
  "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"
]);

export const SettingsIcon = mk([
  "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z",
  "M12 15a3 3 0 100-6 3 3 0 000 6z"
]);

export const ActivityIcon = mk([
  "M22 12h-4l-3 9L9 3l-3 9H2"
]);

export const CheckCircleIcon = mk([
  "M22 11.08V12a10 10 0 11-5.93-9.14",
  "M22 4L12 14.01l-3-3"
]);

export const AlertTriangleIcon = mk([
  "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z",
  "M12 9v4",
  "M12 17h.01"
]);

export const XIcon = mk([
  "M18 6L6 18",
  "M6 6l12 12"
]);

export const PlusIcon = mk([
  "M12 5v14",
  "M5 12h14"
]);

export const SearchIcon = mk([
  "M21 21l-4.35-4.35",
  "M11 19a8 8 0 100-16 8 8 0 000 16z"
]);

export const RefreshIcon = mk([
  "M23 4v6h-6",
  "M1 20v-6h6",
  "M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"
]);

export const PlayIcon = mk([
  "M5 3l14 9-14 9V3z"
]);

export const CircleStopIcon = mk([
  "M12 22a10 10 0 100-20 10 10 0 000 20z",
  "M9 9h6v6H9z"
]);

export const RotateIcon = mk([
  "M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8",
  "M21 3v5h-5",
  "M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16",
  "M3 21v-5h5"
]);

export const DownloadIcon = mk([
  "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4",
  "M7 10l5 5 5-5",
  "M12 15V3"
]);

export const UploadIcon = mk([
  "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4",
  "M17 8l-5-5-5 5",
  "M12 3v12"
]);

export const TrashIcon = mk([
  "M3 6h18",
  "M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6",
  "M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2",
  "M10 11v6",
  "M14 11v6"
]);

export const LockIcon = mk([
  "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z",
  "M7 11V7a5 5 0 0110 0v4"
]);

export const SunIcon = mk([
  "M12 17a5 5 0 100-10 5 5 0 000 10z",
  "M12 1v2",
  "M12 21v2",
  "M4.22 4.22l1.42 1.42",
  "M18.36 18.36l1.42 1.42",
  "M1 12h2",
  "M21 12h2",
  "M4.22 19.78l1.42-1.42",
  "M18.36 5.64l1.42-1.42"
]);

export const MoonIcon = mk([
  "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
]);

export const LogOutIcon = mk([
  "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4",
  "M16 17l5-5-5-5",
  "M21 12H9"
]);

export const UserPlusIcon = mk([
  "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2",
  "M8 11a4 4 0 100-8 4 4 0 000 8z",
  "M19 8v6",
  "M22 11h-6"
]);

export const ShieldIcon = mk([
  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
]);

export const GaugeIcon = mk([
  "M12 22a10 10 0 100-20 10 10 0 000 20z",
  "M12 18a6 6 0 001.5-11.75",
  "M12 14a2 2 0 100-4 2 2 0 000 4z"
]);

export const DatabaseIcon = mk([
  "M4 6c0-1.1 3.6-2 8-2s8 .9 8 2v12c0 1.1-3.6 2-8 2s-8-.9-8-2V6z",
  "M4 12c0 1.1 3.6 2 8 2s8-.9 8-2"
]);

export const ImageIcon = mk([
  "M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z",
  "M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  "M21 15l-5-5L5 21"
]);

export const ArchiveIcon = mk([
  "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"
]);

export const HardDriveIcon = mk([
  "M22 12H2",
  "M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z",
  "M6 16h.01",
  "M10 16h.01"
]);

export const FileCodeIcon = mk([
  "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z",
  "M14 2v6h6",
  "M10 13l-2 2 2 2",
  "M14 13l2 2-2 2"
]);

export const TerminalIcon = mk([
  "M4 17l6-6-6-6",
  "M12 19h8"
]);

export const ImagePlusIcon = mk([
  "M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z",
  "M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z",
  "M21 15l-5-5L5 21",
  "M12 5v6",
  "M9 8h6"
]);

export const ListFilterIcon = mk([
  "M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
]);

export const InfoIcon = mk([
  "M12 22a10 10 0 100-20 10 10 0 000 20z",
  "M12 16v-4",
  "M12 8h.01"
]);

export const GlobeIcon = mk([
  "M12 22a10 10 0 100-20 10 10 0 000 20z",
  "M2 12h20",
  "M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10",
  "M12 2a15.3 15.3 0 00-4 10 15.3 15.3 0 004 10"
]);

export const LoaderIcon = memo(function LoaderIcon({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`animate-spin ${className}`.trim()}
      aria-hidden="true"
    >
      <path
        d="M12 2a10 10 0 1010 10"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
});
