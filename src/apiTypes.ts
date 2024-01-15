//** JSONAPI error object but with some members made compulsory */
export interface ScJsonApiError {
  /** a unique identifier for this particular occurrence of the problem. */
  id?: string;
  ///a links object that MAY contain the following members:
  links?: {
    /** a link that leads to further details about this particular occurrence of
     * the problem. When dereferenced, this URI SHOULD return a human-readable
     * description of the error. */
    about?: string;
    /** a link that identifies the type of error that this particular error is
     * an instance of. This URI SHOULD be dereferenceable to a human-readable
     * explanation of the general error. */
    type?: string;
  };
  /** the HTTP status code applicable to this problem, expressed as a string
   * value. This SHOULD be provided. */
  status?: string;
  /** an application-specific error code, expressed as a string value. */
  code: string;
  /** a short, human-readable summary of the problem that SHOULD NOT change from
   * occurrence to occurrence of the problem, except for purposes of
   * localization. */
  title?: string;
  /** a human-readable explanation specific to this occurrence of the problem.
   * Like title, this field’s value can be localized. */
  detail?: string;
  /** an object containing references to the primary source of the error. It
   * SHOULD include one of the following members or be omitted: */
  source?: {
    /** a JSON Pointer [RFC6901] to the value in the request document that
     * caused the error [e.g. "/data" for a primary data object, or
     * "/data/attributes/title" for a specific attribute]. This MUST point to a
     * value in the request document that exists; if it doesn’t, the client
     * SHOULD simply ignore the pointer. */
    pointer?: string;
    /** a string indicating which URI query parameter caused the error. */
    parameter?: string;
    /** a string indicating the name of a single request header which caused the
     * error. */
    header?: string;
  };
  /** a meta object containing non-standard meta-information about the error. */
  meta?: Record<string, unknown>;
}
