{{- define "nutrimind.name" -}}
nutrimind
{{- end -}}

{{- define "nutrimind.fullname" -}}
{{ .Release.Name }}-nutrimind
{{- end -}}

{{- define "nutrimind.labels" -}}
app.kubernetes.io/name: {{ include "nutrimind.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
nutrimind.ai/region: {{ .Values.region.id }}
{{- end -}}

{{- define "nutrimind.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{ default (include "nutrimind.fullname" .) .Values.serviceAccount.name }}
{{- else -}}
{{ default "default" .Values.serviceAccount.name }}
{{- end -}}
{{- end -}}

{{/*
The referenced Secret object is named the same either way — only who creates it differs:
the ExternalSecret template below (when externalSecrets.enabled) or a manually-applied
`kubectl create secret` (when not, documented in docs/scale/limits.md).
*/}}
{{- define "nutrimind.envFrom" -}}
- secretRef:
    name: {{ include "nutrimind.fullname" . }}-env
{{- end -}}
