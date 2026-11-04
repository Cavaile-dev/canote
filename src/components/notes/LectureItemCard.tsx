import { useState } from "react";
import type { LectureTask } from "../../helpers/lectureAnalysis";
import {
  itemDate,
  itemSyllabus,
  itemGeneratedDate,
  validDueDate,
} from "../../helpers/lectureItemState";
import { Check, X, Pencil } from "../icons";
import { Button } from "../ui/button";

export default function LectureItemCard({
  item,
  label,
  assessment,
  disabled,
  onSave,
}: {
  item: LectureTask;
  label: string;
  assessment: boolean;
  disabled: boolean;
  onSave: (updates: Partial<LectureTask>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [dateText, setDateText] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const beginEdit = () => {
    setText(item.text);
    setDate(item.dueDate ?? "");
    setDateText(item.dateText ?? "");
    setSyllabus(itemSyllabus(item));
    setEditing(true);
  };
  const terminal = item.status === "done" || item.status === "cancelled";
  return (
    <article className="space-y-4 rounded-xl border border-border bg-card p-4 text-sm">
      {item.status === "review" && (
        <p className="text-xs font-medium text-primary">Perlu konfirmasi</p>
      )}
      {editing ? (
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              await onSave({
                text: text.trim(),
                dueDate: date || null,
                dateText: dateText.trim() || null,
                ...(assessment ? { syllabusSummary: syllabus.trim() } : {}),
                edited: true,
              })
            )
              setEditing(false);
          }}
        >
          <label className="block space-y-1">
            <span>Detail {label.toLowerCase()}</span>
            <textarea
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={disabled}
              rows={3}
              className="w-full rounded-lg border border-border bg-background p-3"
            />
          </label>
          {assessment && (
            <label className="block space-y-1">
              <span>Summary kisi-kisi</span>
              <textarea
                value={syllabus}
                onChange={(e) => setSyllabus(e.target.value)}
                disabled={disabled}
                rows={3}
                placeholder="Tidak Diketahui"
                className="w-full rounded-lg border border-border bg-background p-3"
              />
            </label>
          )}
          <label className="block space-y-1">
            <span>Tanggal</span>
            <input
              type="date"
              value={date}
              disabled={disabled}
              onChange={(e) => {
                setDate(e.target.value);
                setDateText("");
              }}
              className="w-full rounded-lg border border-border bg-background p-2"
            />
          </label>
          {!date && (
            <label className="block space-y-1">
              <span>Keterangan waktu</span>
              <input
                value={dateText}
                disabled={disabled}
                onChange={(e) => setDateText(e.target.value)}
                placeholder="Tidak Diketahui"
                className="w-full rounded-lg border border-border bg-background p-2"
              />
            </label>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={disabled || !text.trim()}>
              Simpan
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => setEditing(false)}
            >
              Batal edit
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div>
            <h3 className="mb-1 text-xs font-medium text-muted-foreground">
              Detail {label.toLowerCase()}
            </h3>
            <p className="whitespace-pre-wrap leading-relaxed">{item.text}</p>
          </div>
          {assessment && (
            <div>
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">Summary kisi-kisi</h3>
              <p className="whitespace-pre-wrap leading-relaxed">
                {itemSyllabus(item).trim() || "Tidak Diketahui"}
              </p>
            </div>
          )}
          <div>
            <h3 className="mb-1 text-xs font-medium text-muted-foreground">Tanggal dan hari</h3>
            <p>{itemDate(item)}</p>
          </div>
          {!validDueDate(item.dueDate) && (
            <div>
              <h3 className="mb-1 text-xs font-medium text-muted-foreground">Keterangan waktu</h3>
              <p className="whitespace-pre-wrap">{item.dateText?.trim() || "Tidak Diketahui"}</p>
            </div>
          )}
        </>
      )}
      <div>
        <h3 className="mb-1 text-xs font-medium text-muted-foreground">Dibuat pada</h3>
        <p>{itemGeneratedDate(item)}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!terminal &&
          (item.status === "review" ? (
            <>
              <Button
                size="icon"
                variant="outline"
                aria-label={`Konfirmasi ${label.toLowerCase()}`}
                title="Konfirmasi"
                disabled={disabled || editing}
                onClick={() => void onSave({ status: "approved" })}
              >
                <Check size={16} />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label={`Batalkan ${label.toLowerCase()}`}
                title="Batalkan"
                disabled={disabled || editing}
                onClick={() => void onSave({ status: "cancelled" })}
              >
                <X size={16} />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || editing}
                onClick={() => void onSave({ status: "done" })}
              >
                Selesai
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled || editing}
                onClick={() => void onSave({ status: "cancelled" })}
              >
                Batal
              </Button>
            </>
          ))}
        {terminal && (
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || editing}
            onClick={() => void onSave({ status: "approved" })}
          >
            Aktifkan lagi
          </Button>
        )}
        <Button
          size="icon"
          variant="outline"
          aria-label={`Edit ${label.toLowerCase()}`}
          title="Edit"
          disabled={disabled || editing}
          onClick={beginEdit}
        >
          <Pencil size={16} />
        </Button>
      </div>
    </article>
  );
}
