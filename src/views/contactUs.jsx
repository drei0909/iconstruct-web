function ContactUs() {
  return (
    <div className="container py-5">

      <h1 className="text-center mb-4">Contact Us</h1>

      <p className="text-center mb-5">
        If you have questions about iConstruct, feel free to contact us.
      </p>

      <div className="row justify-content-center">

        <div className="col-md-6">

          <form>

            <div className="mb-3">
              <label className="form-label">Name</label>
              <input type="text" className="form-control" />
            </div>

            <div className="mb-3">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" />
            </div>

            <div className="mb-3">
              <label className="form-label">Message</label>
              <textarea className="form-control" rows="4"></textarea>
            </div>

            <button className="btn btn-primary w-100">
              Send Message
            </button>

          </form>

        </div>

      </div>

    </div>
  );
}

export default ContactUs;