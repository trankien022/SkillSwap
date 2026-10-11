'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import authHtml from '../designs/auth.json';
import exploreHtml from '../designs/explore.json';
import classes from '../data/classes.json';
import {
  api,
  authenticate,
  tokens,
  logout as logoutSession,
} from '../lib/api.mjs';

const normalize = text =>
  text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

export default function StitchScreen({ screen }) {
  const root = useRef(null);
  const router = useRouter();
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const $ = selector => el.querySelector(selector);
    const all = selector => [...el.querySelectorAll(selector)];
    let user = null;
    let disposed = false;
    const timers = [];
    const listeners = [];

    const on = (node, event, fn) => {
      if (!node) return;
      node.addEventListener(event, fn);
      listeners.push(() => node.removeEventListener(event, fn));
    };

    const notify = text => {
      if (!disposed) setNotice(text);
    };

    const run = async (button, task) => {
      if (button.disabled) return;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');

      try {
        await task();
      } catch (error) {
        notify(error.message);
      } finally {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    };

    all('a[href="#"]').forEach(link =>
      on(link, 'click', event => {
        event.preventDefault();
        notify('Chức năng này chưa nằm trong bản demo hai màn hình.');
      })
    );

    if (screen === 'auth') {
      const switchTab = tab => {
        $('#register-pane').classList.toggle('hidden', tab !== 'register');
        $('#login-pane').classList.toggle('hidden', tab !== 'login');

        for (const mode of ['register', 'login']) {
          const button = $('#tab-' + mode + '-btn');
          button.classList.toggle('border-primary', tab === mode);
          button.classList.toggle('text-primary', tab === mode);
          button.classList.toggle('border-transparent', tab !== mode);
          button.setAttribute('aria-selected', String(tab === mode));
        }
      };

      all('[data-onclick]').forEach(button =>
        on(button, 'click', () => {
          const action = button.dataset.onclick;

          if (action.startsWith('switchAuthTab')) {
            return switchTab(
              action.includes('register') ? 'register' : 'login'
            );
          }

          if (action.startsWith('togglePasswordVisibility')) {
            const input = $(
              action.includes('reg-password')
                ? '#reg-password'
                : '#login-password'
            );

            input.type = input.type === 'password' ? 'text' : 'password';

            button.setAttribute(
              'aria-label',
              input.type === 'password' ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'
            );
            return;
          }

          if (action === 'simulateRegisterSubmit()') {
            const displayName = $('#reg-fullname').value.trim();
            const email = $('#reg-email').value.trim();
            const password = $('#reg-password').value;

            if (
              !displayName ||
              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
              password.length < 8
            ) {
              return notify(
                'Nhập họ tên, email hợp lệ và mật khẩu từ 8 ký tự.'
              );
            }

            if (!$('#academic-pledge').checked) {
              return notify('Bạn cần đồng ý điều khoản trước khi đăng ký.');
            }

            return run(button, async () => {
              await authenticate('register', {
                email,
                displayName,
                password,
                role: 'user',
              });

              if (!disposed) router.push('/');
            });
          }

          if (action === 'simulateLoginSubmit()') {
            const email = $('#login-identifier').value.trim();
            const password = $('#login-password').value;

            if (!email || password.length < 8) {
              return notify('Nhập email và mật khẩu từ 8 ký tự.');
            }

            return run(button, async () => {
              await authenticate(
                'login',
                { email, password },
                $('#remember-device')?.checked === true
              );

              if (!disposed) router.push('/');
            });
          }
        })
      );

      all('button')
        .filter(button =>
          /Google Học đường|Microsoft 365/.test(button.textContent)
        )
        .forEach(button => {
          const provider = button.textContent.includes('Google')
            ? 'Google Học đường'
            : 'Microsoft 365';

          button.disabled = true;
          button.title = 'Chức năng đăng nhập này chưa được hỗ trợ';
          button.style.opacity = '0.55';

          let hint = button.querySelector('[data-provider-hint]');
          if (!hint) {
            hint = document.createElement('span');
            hint.dataset.providerHint = 'true';
            hint.className = 'text-xs';
            hint.textContent = ' (chưa hỗ trợ)';
            button.append(hint);
          }

          button.setAttribute('aria-label', provider + ' chưa hỗ trợ');
        });

      const university = $('#reg-university');
      const universities = [
        ['fpt', 'Đại học FPT'],
        ['hcmus', 'Đại học Khoa học Tự nhiên – ĐHQG TP.HCM'],
        ['hutech', 'Đại học Công nghệ TP.HCM – HUTECH'],
        ['hcmut', 'Đại học Bách khoa – ĐHQG TP.HCM'],
        ['ueh', 'Đại học Kinh tế TP.HCM – UEH'],
        ['uit', 'Đại học Công nghệ Thông tin – ĐHQG TP.HCM'],
        ['tdtu', 'Đại học Tôn Đức Thắng'],
      ];

      if (university) {
        university.replaceChildren(
          new Option('Chọn trường đại học...', ''),
          ...universities.map(([value, name]) => new Option(name, value))
        );

        university.disabled = false;
        university.required = false;
        university.title = '';
        university.value = '';

        const label = $('label[for="reg-university"]');
        if (label) {
          label.textContent = 'Trường Đại học (không bắt buộc)';
        }

        let hint = $('#university-hint');
        if (!hint) {
          hint = document.createElement('p');
          hint.id = 'university-hint';
          hint.className = 'mt-2 text-xs text-slate-500';
          university.insertAdjacentElement('afterend', hint);
        }

        hint.textContent =
          'Thông tin trường đã chọn chưa được lưu vào tài khoản.';
      }

      const create = $('[data-onclick="simulateRegisterSubmit()"] span');
      if (create) create.textContent = 'Tạo tài khoản';

      on($('#reg-password'), 'input', () => {
        const password = $('#reg-password').value;
        const strength =
          Number(password.length >= 8) +
          Number(/[A-Z]/.test(password)) +
          Number(/\d/.test(password)) +
          Number(/[^\w]/.test(password));

        for (let i = 1; i <= 4; i++) {
          const meter = $('#meter-' + i);
          if (meter) {
            meter.style.backgroundColor =
              i <= strength ? '#10b981' : '#e2e8f0';
          }
        }
      });

      all('input').forEach(input =>
        on(input, 'keydown', event => {
          if (event.key !== 'Enter') return;
          event.preventDefault();

          const mode = $('#register-pane').classList.contains('hidden')
            ? 'Login'
            : 'Register';

          $(`[data-onclick="simulate${mode}Submit()"]`)?.click();
        })
      );

      all('a')
        .filter(link =>
          link.textContent.includes('Khám phá lớp') ||
          link.textContent.trim() === 'SkillSwap'
        )
        .forEach(link => {
          link.href = '/';
        });

      const remember = $('#remember-device');
      if (remember) {
        remember.disabled = false;
        remember.checked = false;
        remember.title =
          'Giữ đăng nhập trên trình duyệt này tối đa 30 ngày';

        const label = $('label[for="remember-device"]');
        if (label) {
          label.textContent = 'Ghi nhớ đăng nhập trong 30 ngày';
        }
      }

      switchTab(
        new URLSearchParams(window.location.search).get('tab') === 'register'
          ? 'register'
          : 'login'
      );
    } else {
      const header = $('header');
      const actions = header.firstElementChild.lastElementChild;

      const refreshUser = () => {
        actions.replaceChildren();
        actions.classList.add('flex', 'items-center', 'gap-4');

        if (!user) {
          for (const [title, tab] of [
            ['Đăng nhập', 'login'],
            ['Đăng ký', 'register'],
          ]) {
            const link = document.createElement('a');
            link.href = '/auth?tab=' + tab;
            link.textContent = title;
            link.className =
              tab === 'register'
                ? 'px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold'
                : 'text-sm font-semibold text-primary';

            actions.append(link);
          }
        } else {
          const profile = document.createElement('div');
          profile.className = 'flex flex-col text-right';

          const name = document.createElement('span');
          name.className = 'text-sm font-semibold text-slate-900';
          name.textContent = user.name || user.email || 'Tài khoản';

          const balance = document.createElement('span');
          balance.className = 'text-xs text-slate-500';
          balance.textContent =
            user.credit === null
              ? 'Đang tải ví…'
              : `${user.credit} Credits`;

          profile.append(name, balance);

          const logout = document.createElement('button');
          logout.type = 'button';
          logout.textContent = 'Đăng xuất';
          logout.className =
            'px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600';

          logout.onclick = () =>
            run(logout, async () => {
              try {
                await logoutSession();
              } finally {
                user = null;
                if (!disposed) {
                  refreshUser();
                  notify('Đã đăng xuất trên trình duyệt.');
                }
              }
            });

          actions.append(profile, logout);
        }

        const wallet = all('aside > div')[0];
        if (wallet) {
          wallet.hidden = !user;

          const amount = wallet.querySelector('.text-3xl');
          if (amount && user) {
            amount.textContent =
              user.credit === null ? '—' : String(user.credit);
          }

          const hint = wallet.querySelector('p');
          if (hint && user) {
            hint.textContent =
              `Thu nhập đang giữ: ${user.pending ?? '—'} Credits`;
          }
        }
      };

      const bookButtons = all('[data-onclick^="showBookingToast"]');
      const cards = bookButtons.map(button => button.closest('article'));
      const prices = classes.map(item => item.price);
      const categories = classes.map(item => item.category);
      const modes = classes.map(item => item.mode);
      const input = $('main input');
      const selects = all('main select');

      input.value = '';
      selects.forEach(select => {
        select.value = 'all';
      });

      if (!selects[0].querySelector('option[value="presentation"]')) {
        const option = document.createElement('option');
        option.value = 'presentation';
        option.textContent = 'Kỹ năng thuyết trình';
        selects[0].append(option);
      }

      let chip = 'all';
      let empty = $('#empty-results');

      if (!empty) {
        empty = document.createElement('p');
        empty.id = 'empty-results';
        empty.className = 'p-6 text-slate-500';
        empty.textContent =
          'Không có lớp phù hợp. Hãy thử từ khóa hoặc bộ lọc khác.';
        cards[0].parentElement.append(empty);
      }

      const filter = () => {
        let count = 0;

        cards.forEach((card, i) => {
          const max =
            selects[2].value === 'under-120'
              ? 120
              : selects[2].value === 'under-90'
                ? 90
                : Infinity;

          const visible =
            normalize(card.textContent).includes(
              normalize(input.value.trim())
            ) &&
            (selects[0].value === 'all' ||
              categories[i] === selects[0].value) &&
            (chip === 'all' || categories[i] === chip) &&
            (selects[1].value === 'all' ||
              modes[i] === selects[1].value) &&
            prices[i] < max;

          card.hidden = !visible;
          if (visible) count++;
        });

        const countText = all('main span.font-medium')
          .find(node => node.textContent.includes('Tìm thấy'));

        if (countText) {
          countText.textContent =
            `Tìm thấy ${count} lớp học phù hợp tuần này`;
        }

        empty.hidden = count !== 0;
      };

      const chips = all('main button').filter(button =>
        /^(Tất cả|Tiếng Anh|Lập trình Frontend|Figma &|Data Science|Kỹ năng thuyết trình)/
          .test(button.textContent.trim())
      );

      const keys = [
        'all', 'lang', 'tech', 'design', 'data', 'presentation',
      ];

      chips[0].textContent = 'Tất cả (4)';
      chips.forEach((button, i) =>
        on(button, 'click', () => {
          chip = keys[i];

          chips.forEach(item => {
            item.style.backgroundColor =
              item === button ? '#0f172a' : 'white';
            item.style.color =
              item === button ? 'white' : '#334155';
          });

          filter();
        })
      );

      on(input, 'input', filter);

      on($('[aria-label="Xoá tìm kiếm"]'), 'click', () => {
        input.value = '';
        filter();
      });

      selects.forEach(select => on(select, 'change', filter));

      on(
        all('main button').find(button =>
          button.textContent.includes('Áp dụng')
        ),
        'click',
        filter
      );

      bookButtons.forEach(button =>
        on(button, 'click', () => {
          if (!user) {
            router.push('/auth?tab=login');
            return;
          }

          notify(
            'Lớp này là dữ liệu mock, chưa có ID lớp thật để đặt qua backend.'
          );
        })
      );

      all('button')
        .filter(button => button.textContent.includes('Nạp thêm Credits'))
        .forEach(button =>
          on(button, 'click', () =>
            run(button, async () => {
              if (!tokens()) {
                router.push('/auth?tab=login');
                return;
              }

              const raw = window.prompt(
                'Số tiền nạp (VND), bội số của 1.000, tối đa 100.000.000:',
                '100000'
              );

              if (raw === null) return;

              const amountVnd = Number(raw);

              if (
                !Number.isInteger(amountVnd) ||
                amountVnd <= 0 ||
                amountVnd > 100000000 ||
                amountVnd % 1000 !== 0
              ) {
                throw new Error(
                  'Số tiền phải là số nguyên dương, bội số 1.000 và không quá 100.000.000 VND.'
                );
              }

              const intent = await api('/wallet/top-ups', {
                method: 'POST',
                body: { amountVnd },
              });

              const url = new URL(intent.paymentUrl);

              if (!['https:', 'http:'].includes(url.protocol)) {
                throw new Error('URL thanh toán không hợp lệ.');
              }

              if (!disposed) window.location.assign(url.href);
            })
          )
        );

      all('button')
        .filter(button => button.textContent.includes('Xem thêm'))
        .forEach(button =>
          on(button, 'click', () =>
            notify('Đã hiển thị toàn bộ 4 lớp mock.')
          )
        );

      const loadBalance = async () => {
        const currentUser = user;
        if (!currentUser) return;

        try {
          const balance = await api('/wallet/balance');
          if (disposed || user !== currentUser) return;

          user.credit = balance.availableCredits;
          user.pending = balance.pendingCredits;
          refreshUser();
        } catch (error) {
          if (disposed || user !== currentUser) return;

          if (!tokens()) {
            user = null;
            refreshUser();
          }

          notify(error.message);
        }
      };

      refreshUser();
      filter();

      if (tokens()) {
        api('/auth/me')
          .then(account => {
            if (disposed) return;

            user = {
              ...account,
              name: account.displayName,
              credit: null,
              pending: null,
            };

            refreshUser();
            loadBalance();
          })
          .catch(error => notify(error.message));
      }

      on(window, 'focus', () => {
        if (user) loadBalance();
      });

      timers.push(setInterval(() => {
        if (user && document.visibilityState === 'visible') {
          loadBalance();
        }
      }, 15000));

      listeners.push(() => {
        const logout = actions.querySelector('button');
        if (logout) logout.onclick = null;
      });
    }

    return () => {
      disposed = true;
      listeners.forEach(remove => remove());
      timers.forEach(clearInterval);
    };
  }, [screen, router]);

  return (
    <>
      <div
        ref={root}
        className={'stitch-root ' + screen}
        dangerouslySetInnerHTML={{
          __html: screen === 'auth' ? authHtml : exploreHtml,
        }}
      />

      {notice && (
        <div role="status" className="demo-notice">
          {notice}
        </div>
      )}
    </>
  );
}