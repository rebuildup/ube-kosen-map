export type ItemType = "event" | "exhibit" | "stall" | "sponsor";

export interface Coordinate {
  x: number;
  y: number;
}

export interface BaseItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  date: string;
  time: string;
  location: string;
  coordinates?: Coordinate; // マップ上の座標（オプショナル）
  tags: string[];
}

export interface Event extends BaseItem {
  type: "event";
  organizer: string;
  duration: number; // in minutes
  showOnMap: boolean;
  showOnSchedule: boolean;
  dayAvailability: "day1" | "day2" | "both";
}

export interface Exhibit extends BaseItem {
  type: "exhibit";
  creator: string;
}

export interface Stall extends BaseItem {
  type: "stall";
  organizer: string;
  products: string[];
}

export interface Sponsor extends BaseItem {
  type: "sponsor";
  website: string;
  contactEmail?: string;
}

export type Item = Event | Exhibit | Stall | Sponsor;
