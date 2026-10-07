/**
 * Durable payload carried by a chat routine confirmation card.
 *
 * Tool input is normalized before it reaches this shape: timestamps are
 * milliseconds, weekly day names are the scheduler's numeric weekday values,
 * and every text field has already been scrubbed for credential-shaped data.
 * Keeping the normalized operation on the card lets a confirmation survive an
 * app restart without asking the model to interpret the request again.
 */
export {};
