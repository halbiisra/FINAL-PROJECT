/* RUMA — account.js
 * Fitur umum semua peran: Edit Profil & Ubah Kata Sandi (modal).
 * Pemasangan: Account.mount(user, onUpdate) — butuh tombol #profileBtn dan #passBtn. */
const Account = (() => {
  const unitOptions = (sel) =>
    U.UNITS.map(
      (u) => `<option ${u === sel ? "selected" : ""}>${U.esc(u)}</option>`,
    ).join("");

  function errBox(body) {
    return body.querySelector(".form-error");
  }
  function showErr(body, errs) {
    const el = errBox(body);
    el.hidden = false;
    el.innerHTML =
      errs.length > 1
        ? "<ul>" + errs.map((m) => `<li>${U.esc(m)}</li>`).join("") + "</ul>"
        : U.esc(errs[0]);
  }

  const PENCIL =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

  /* Edit profil: hanya nama lengkap, No. HP (opsional), dan foto profil.
   * Username & email (serta NIDN & unit untuk pemohon) cukup ditetapkan sekali saat daftar → hanya tampil, tidak bisa diubah. */
  function profileModal(user, onUpdate) {
    const isAdmin = user.role === "admin";
    const body = document.createElement("div");
    let photo = user.photo || "";
    body.innerHTML = `
      <div class="profile-head">
        <div class="avatar-edit">
          <span class="avatar avatar-lg" id="pPhotoPrev" aria-hidden="true"></span>
          <button type="button" class="pen-badge" id="pPhotoPick" aria-label="Ganti foto profil" title="Ganti foto profil">${PENCIL}</button>
        </div>
        <div class="name-edit">
          <input id="pName" class="name-input" value="${U.esc(user.name)}" autocomplete="name" aria-label="Nama lengkap" maxlength="60" readonly>
          <button type="button" class="pen-btn" id="pNamePen" aria-label="Ubah nama lengkap" title="Ubah nama lengkap">${PENCIL}</button>
        </div>
      </div>
      <button type="button" class="link photo-del" id="pPhotoDel">Hapus foto</button>
      <small class="hint photo-hint">Foto: JPG, PNG, atau WEBP — otomatis dipotong persegi &amp; dikecilkan.</small>

      <div class="field"><label for="pUsername">Username</label><input id="pUsername" value="${U.esc(user.username)}" disabled></div>
      <div class="field"><label for="pEmail">Email</label><input id="pEmail" value="${U.esc(user.email)}" disabled></div>
      ${
        isAdmin
          ? ""
          : `
      <div class="grid-2">
        <div class="field"><label for="pId">NIDN</label><input id="pId" value="${U.esc(user.idNo || "")}" disabled></div>
        <div class="field"><label for="pUnit">Unit</label><input id="pUnit" value="${U.esc(user.unit || "")}" disabled></div>
      </div>`
      }
      <div class="field"><label for="pPhone">No. HP <span class="opt-tag">opsional</span></label>
        <div class="input-pen">
          <input id="pPhone" type="tel" inputmode="tel" value="${U.esc(user.phone || "")}" autocomplete="tel" placeholder="Contoh: 081234567890">
          <button type="button" class="pen-btn" id="pPhonePen" aria-label="Ubah nomor HP" title="Ubah nomor HP">${PENCIL}</button>
        </div>
      </div>
      <p class="hint lock-note">Username, email${isAdmin ? "" : ", NIDN, dan unit"} ditetapkan saat pendaftaran sehingga tidak dapat diubah.</p>
      <div class="form-error" role="alert" hidden></div>
      <input type="file" id="pPhotoFile" accept="image/jpeg,image/png,image/webp" hidden>`;

    const nameIn = body.querySelector("#pName");
    const prev = body.querySelector("#pPhotoPrev");
    const paintPrev = () =>
      UI.paintAvatar(prev, { name: nameIn.value || user.name, photo });
    paintPrev();
    nameIn.addEventListener("input", paintPrev);

    const editName = () => {
      nameIn.readOnly = false;
      nameIn.classList.add("editing");
      nameIn.focus();
      nameIn.setSelectionRange(nameIn.value.length, nameIn.value.length);
    };
    body.querySelector("#pNamePen").addEventListener("click", editName);
    nameIn.addEventListener("dblclick", editName);
    nameIn.addEventListener("blur", () => {
      nameIn.readOnly = true;
      nameIn.classList.remove("editing");
    });

    body
      .querySelector("#pPhonePen")
      .addEventListener("click", () => body.querySelector("#pPhone").focus());
    body
      .querySelector("#pPhotoPick")
      .addEventListener("click", () =>
        body.querySelector("#pPhotoFile").click(),
      );
    body.querySelector("#pPhotoDel").addEventListener("click", () => {
      photo = "";
      paintPrev();
    });
    body.querySelector("#pPhotoFile").addEventListener("change", async (e) => {
      const f = e.target.files[0];
      e.target.value = "";
      if (!f) return;
      try {
        photo = await U.readImage(f);
        errBox(body).hidden = true;
        paintPrev();
      } catch (err) {
        showErr(body, [err.message]);
      }
    });

    UI.modal({
      title: "Edit profil",
      body,
      actions: [
        { label: "Batal", kind: "ghost" },
        {
          label: "Simpan",
          kind: "primary",
          onClick: (close) => {
            const res = Auth.updateProfile(user.id, {
              name: nameIn.value,
              phone: body.querySelector("#pPhone").value,
              photo,
            });
            if (!res.ok) {
              showErr(body, res.errors);
              return;
            }
            close();
            UI.toast("Profil diperbarui.", "ok");
            if (onUpdate) onUpdate(res.user);
          },
        },
      ],
    });
  }

  function passwordModal(user) {
    const body = document.createElement("div");
    body.innerHTML = `
      <div class="field"><label for="wOld">Password lama</label><input id="wOld" type="password" autocomplete="current-password"></div>
      <div class="field"><label for="wNew">Password baru</label><input id="wNew" type="password" autocomplete="new-password"></div>
      <div class="field"><label for="wNew2">Ulangi password baru</label><input id="wNew2" type="password" autocomplete="new-password"></div>
      <div class="form-error" role="alert" hidden></div>`;
    UI.modal({
      title: "Ubah kata sandi",
      body,
      actions: [
        { label: "Batal", kind: "ghost" },
        {
          label: "Simpan",
          kind: "primary",
          onClick: (close) => {
            const res = Auth.changePassword(
              user.id,
              body.querySelector("#wOld").value,
              body.querySelector("#wNew").value,
              body.querySelector("#wNew2").value,
            );
            if (!res.ok) {
              showErr(body, res.errors);
              return;
            }
            close();
            UI.toast("Kata sandi diperbarui.", "ok");
          },
        },
      ],
    });
  }

  function mount(user, onUpdate) {
    document
      .getElementById("profileBtn")
      .addEventListener("click", () =>
        profileModal(Store.users.get(user.id), onUpdate),
      );
    document
      .getElementById("passBtn")
      .addEventListener("click", () => passwordModal(Store.users.get(user.id)));
  }

  return { mount, unitOptions };
})();
