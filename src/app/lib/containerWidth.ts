export const CONTAINER_WIDTH_OPTIONS = [
  { id: "sm", label: "Small", description: "896 px", className: "max-w-4xl" },
  { id: "md", label: "Medium", description: "1280 px", className: "max-w-7xl" },
  { id: "lg", label: "Large", description: "1536 px", className: "max-w-[96rem]" },
  { id: "full", label: "Full width", description: "Fit screen", className: "max-w-none" },
] as const;

export type ContainerWidth = (typeof CONTAINER_WIDTH_OPTIONS)[number]["id"];
export const DEFAULT_CONTAINER_WIDTH: ContainerWidth = "md";

export function isContainerWidth(value: unknown): value is ContainerWidth {
  return CONTAINER_WIDTH_OPTIONS.some((option) => option.id === value);
}
