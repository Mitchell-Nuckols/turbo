import { FetchResponse } from "./fetch_response"
import { Location } from "../core/location"
import { dispatch } from "../util"

export interface FetchRequestDelegate {
  additionalHeadersForRequest?(request: FetchRequest): { [header: string]: string }
  requestStarted(request: FetchRequest): void
  requestPreventedHandlingResponse(request: FetchRequest, response: FetchResponse): void
  requestSucceededWithResponse(request: FetchRequest, response: FetchResponse): void
  requestFailedWithResponse(request: FetchRequest, response: FetchResponse): void
  requestErrored(request: FetchRequest, error: Error): void
  requestFinished(request: FetchRequest): void
}

export enum FetchMethod {
  get,
  post,
  put,
  patch,
  delete
}

export function fetchMethodFromString(method: string) {
  switch (method.toLowerCase()) {
    case "get":    return FetchMethod.get
    case "post":   return FetchMethod.post
    case "put":    return FetchMethod.put
    case "patch":  return FetchMethod.patch
    case "delete": return FetchMethod.delete
  }
}

export enum EncodingType {
  application_json,
  application_x_www_form_urlencoded,
  multipart_form_data
}

export function encodingTypeFromString(encoding: string): EncodingType {
  switch (encoding.toLowerCase()) {
    case "application/json": return EncodingType.application_json
    case "application/x-www-form-urlencoded": return EncodingType.application_x_www_form_urlencoded
    case "multipart/form-data": return EncodingType.multipart_form_data
  }

  return EncodingType.multipart_form_data
}

function encodingTypeToContentType(encoding: EncodingType): string {
  switch (encoding) {
    case EncodingType.application_json: return "application/json"
    case EncodingType.application_x_www_form_urlencoded: return "application/x-www-form-urlencoded"
    case EncodingType.multipart_form_data: return "multipart/form-data"
  }

  return ""
}

export type FetchRequestBody = FormData | string

export type FetchRequestHeaders = { [header: string]: string }

export interface FetchRequestOptions {
  headers: FetchRequestHeaders
  body: FetchRequestBody
  followRedirects: boolean
}

export class FetchRequest {
  readonly delegate: FetchRequestDelegate
  readonly method: FetchMethod
  readonly encodingType: EncodingType
  readonly location: Location
  readonly body?: FetchRequestBody
  readonly abortController = new AbortController

  constructor(delegate: FetchRequestDelegate, method: FetchMethod, location: Location, encodingType?: EncodingType, body?: FetchRequestBody) {
    this.delegate = delegate
    this.method = method
    this.encodingType = encodingType || EncodingType.multipart_form_data
    this.location = location
    this.body = body
  }

  get url() {
    const url = this.location.absoluteURL
    if (this.isIdempotent) {
      const query = this.params.toString()
      if (query.length) {
        return [url, query].join(url.includes("?") ? "&" : "?")
      }
    }

    return url
  }

  get params() {
    return this.entries.reduce((params, [name, value]) => {
      params.append(name, value.toString())
      return params
    }, new URLSearchParams)
  }

  get entries() {
    return this.body ? Array.from((this.body as FormData).entries()) : []
  }

  cancel() {
    this.abortController.abort()
  }

  async perform(): Promise<FetchResponse> {
    const { fetchOptions } = this
    dispatch("turbo:before-fetch-request", { detail: { fetchOptions } })
    try {
      this.delegate.requestStarted(this)
      const response = await fetch(this.url, fetchOptions)
      return await this.receive(response)
    } catch (error) {
      this.delegate.requestErrored(this, error)
      throw error
    } finally {
      this.delegate.requestFinished(this)
    }
  }

  async receive(response: Response): Promise<FetchResponse> {
    const fetchResponse = new FetchResponse(response)
    const event = dispatch("turbo:before-fetch-response", { cancelable: true, detail: { fetchResponse } })
    if (event.defaultPrevented) {
      this.delegate.requestPreventedHandlingResponse(this, fetchResponse)
    } else if (fetchResponse.succeeded) {
      this.delegate.requestSucceededWithResponse(this, fetchResponse)
    } else {
      this.delegate.requestFailedWithResponse(this, fetchResponse)
    }
    return fetchResponse
  }

  get bodyContent() {
    if (this.isIdempotent) return undefined
    else return this.body
  }

  get fetchOptions(): RequestInit {
    return {
      method: FetchMethod[this.method].toUpperCase(),
      credentials: "same-origin",
      headers: this.headers,
      redirect: "follow",
      body: this.bodyContent,
      signal: this.abortSignal
    }
  }

  get isIdempotent() {
    return this.method == FetchMethod.get
  }

  get headers() {
    return {
      "Accept": "text/html, application/xhtml+xml",
      "Content-Type": encodingTypeToContentType(this.encodingType),
      ...this.additionalHeaders
    }
  }

  get additionalHeaders() {
    if (typeof this.delegate.additionalHeadersForRequest == "function") {
      return this.delegate.additionalHeadersForRequest(this)
    } else {
      return {}
    }
  }

  get abortSignal() {
    return this.abortController.signal
  }
}
